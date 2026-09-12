use std::{
    cell::{Cell, RefCell},
    rc::Rc,
    sync::atomic::{AtomicU32, Ordering},
    time::{Duration, Instant},
};

use gpui::{
    div, prelude::*, px, rgb, AnyElement, AnyView, App, Bounds, Context, Element, ElementId,
    Entity, EntityId, GlobalElementId, InspectorElementId, LayoutId, Pixels, Render, Style,
    StyleRefinement, TestAppContext, Window,
};

use crate::{
    platform::{benchmark_root_view, prepare_frame},
    protocol::{Command, PropertyValue},
    protocol_generated::{ElementKind, PropertyId},
    render::{build_subtree_with_runtime, build_with_runtime},
    runtime_state::RuntimeStateRegistry,
    tree::{NativeTree, WindowId},
};

#[cfg(debug_assertions)]
const WARMUP_FRAMES: usize = 1;
#[cfg(not(debug_assertions))]
const WARMUP_FRAMES: usize = 5;
#[cfg(debug_assertions)]
const SAMPLE_FRAMES: usize = 3;
#[cfg(not(debug_assertions))]
const SAMPLE_FRAMES: usize = 20;
const FRAME_STEP: Duration = Duration::from_micros(16_667);

#[derive(Clone, Copy, Debug)]
enum Scenario {
    StaticRedraw,
    Opacity,
    Width,
}

impl Scenario {
    fn name(self) -> &'static str {
        match self {
            Self::StaticRedraw => "static-redraw",
            Self::Opacity => "opacity",
            Self::Width => "width",
        }
    }

    fn is_animation(self) -> bool {
        !matches!(self, Self::StaticRedraw)
    }
}

#[derive(Default)]
struct RenderTimings {
    prepare: Cell<Duration>,
    build: Cell<Duration>,
    renders: Cell<usize>,
}

#[derive(Default)]
struct PhaseTimings {
    request_layout: Cell<Duration>,
    layout: Cell<Duration>,
    prepaint: Cell<Duration>,
    paint: Cell<Duration>,
}

struct PhaseHarness {
    inner: AnyElement,
    timings: Rc<PhaseTimings>,
}

impl IntoElement for PhaseHarness {
    type Element = Self;

    fn into_element(self) -> Self::Element {
        self
    }
}

impl Element for PhaseHarness {
    type RequestLayoutState = ();
    type PrepaintState = ();

    fn id(&self) -> Option<ElementId> {
        None
    }

    fn source_location(&self) -> Option<&'static std::panic::Location<'static>> {
        None
    }

    fn request_layout(
        &mut self,
        _id: Option<&GlobalElementId>,
        _inspector_id: Option<&InspectorElementId>,
        window: &mut Window,
        cx: &mut App,
    ) -> (LayoutId, ()) {
        (window.request_layout(Style::default(), None, cx), ())
    }

    fn prepaint(
        &mut self,
        _id: Option<&GlobalElementId>,
        _inspector_id: Option<&InspectorElementId>,
        bounds: Bounds<Pixels>,
        _request_layout: &mut (),
        window: &mut Window,
        cx: &mut App,
    ) {
        let started = Instant::now();
        let layout_id = self.inner.request_layout(window, cx);
        self.timings.request_layout.set(started.elapsed());

        let started = Instant::now();
        window.compute_layout(layout_id, bounds.size.into(), cx);
        self.timings.layout.set(started.elapsed());

        let started = Instant::now();
        self.inner.prepaint_at(bounds.origin, window, cx);
        self.timings.prepaint.set(started.elapsed());
    }

    fn paint(
        &mut self,
        _id: Option<&GlobalElementId>,
        _inspector_id: Option<&InspectorElementId>,
        _bounds: Bounds<Pixels>,
        _request_layout: &mut (),
        _prepaint: &mut (),
        window: &mut Window,
        cx: &mut App,
    ) {
        let started = Instant::now();
        self.inner.paint(window, cx);
        self.timings.paint.set(started.elapsed());
    }
}

struct ProfiledView {
    inner: AnyView,
    inner_id: EntityId,
    timings: Rc<PhaseTimings>,
}

impl Render for ProfiledView {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        PhaseHarness {
            inner: self.inner.clone().into_any_element(),
            timings: self.timings.clone(),
        }
    }
}

struct BenchmarkView {
    tree: Rc<RefCell<NativeTree>>,
    runtime: RuntimeStateRegistry,
    window_id: WindowId,
    timings: Rc<RenderTimings>,
}

impl Render for BenchmarkView {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        self.timings.renders.set(self.timings.renders.get() + 1);
        let tree = self.tree.borrow();

        let started = Instant::now();
        let generation = prepare_frame(&tree, &self.runtime, self.window_id, window, cx);
        self.timings.prepare.set(started.elapsed());

        let started = Instant::now();
        let element = build_with_runtime(
            &tree,
            tree.windows[&self.window_id].root_id,
            &self.runtime,
            generation,
            window,
            cx,
        );
        self.timings.build.set(started.elapsed());
        element
    }
}

#[derive(Clone, Copy)]
struct TestDrawSample {
    total: Duration,
    draw: Duration,
    present_hook: Duration,
}

fn draw_test_frame(cx: &mut gpui::VisualTestContext) -> TestDrawSample {
    let started = Instant::now();
    let draw = Cell::new(Duration::ZERO);
    let present_hook = Cell::new(Duration::ZERO);
    cx.update(|window, cx| {
        let draw_started = Instant::now();
        let arena = window.draw(cx);
        draw.set(draw_started.elapsed());
        let present_started = Instant::now();
        // TestAppContext uses GPUI's CPU-only test platform with no native renderer.
        // This measures the present hook overhead, not GPU submission/presentation.
        window.present_if_needed();
        present_hook.set(present_started.elapsed());
        arena.clear(cx);
    });
    TestDrawSample {
        total: started.elapsed(),
        draw: draw.get(),
        present_hook: present_hook.get(),
    }
}

#[derive(Clone, Copy)]
struct FrameSample {
    total: Duration,
    draw: Duration,
    present_hook: Duration,
    prepare: Duration,
    build: Duration,
}

impl FrameSample {
    fn gpui_draw_rest(self) -> Duration {
        self.draw
            .saturating_sub(self.prepare)
            .saturating_sub(self.build)
    }
}

#[derive(Clone, Copy)]
struct PhaseSample {
    draw: Duration,
    present_hook: Duration,
    request: Duration,
    layout: Duration,
    prepaint: Duration,
    paint: Duration,
    residual: Duration,
}

impl PhaseSample {
    fn capture(draw: TestDrawSample, timings: &PhaseTimings) -> Self {
        let request = timings.request_layout.get();
        let layout = timings.layout.get();
        let prepaint = timings.prepaint.get();
        let paint = timings.paint.get();
        Self {
            draw: draw.draw,
            present_hook: draw.present_hook,
            request,
            layout,
            prepaint,
            paint,
            residual: draw
                .draw
                .saturating_sub(request)
                .saturating_sub(layout)
                .saturating_sub(prepaint)
                .saturating_sub(paint),
        }
    }
}

fn container(id: u32) -> Command {
    Command::CreateNode {
        id,
        kind: ElementKind::Container,
    }
}

fn insert(parent_id: u32, child_id: u32) -> Command {
    Command::InsertChild {
        parent_id,
        child_id,
        before_id: 0,
    }
}

fn static_properties() -> Vec<(PropertyId, PropertyValue)> {
    vec![
        (PropertyId::Width, PropertyValue::Number(100.0)),
        (PropertyId::Height, PropertyValue::Number(1.0)),
        (
            PropertyId::BackgroundColor,
            PropertyValue::String("#336699".into()),
        ),
    ]
}

fn animated_properties(scenario: Scenario, target: bool) -> Vec<(PropertyId, PropertyValue)> {
    let mut properties = static_properties();
    match scenario {
        Scenario::Opacity => {
            properties.push((
                PropertyId::Opacity,
                PropertyValue::Number(if target { 0.9 } else { 0.1 }),
            ));
            properties.push((
                PropertyId::TransitionProperty,
                PropertyValue::String("opacity".into()),
            ));
        }
        Scenario::Width => {
            properties[0] = (
                PropertyId::Width,
                PropertyValue::Number(if target { 200.0 } else { 100.0 }),
            );
            properties.push((
                PropertyId::TransitionProperty,
                PropertyValue::String("width".into()),
            ));
        }
        Scenario::StaticRedraw => return properties,
    }
    properties.push((
        PropertyId::TransitionDuration,
        PropertyValue::String("10s".into()),
    ));
    properties.push((
        PropertyId::TransitionTimingFunction,
        PropertyValue::String("linear".into()),
    ));
    properties
}

fn build_tree(node_count: usize, scenario: Scenario) -> (Rc<RefCell<NativeTree>>, WindowId) {
    let mut tree = NativeTree::default();
    let window_id = tree.create_window(1).unwrap();
    let mut commands = Vec::with_capacity(node_count * 3);
    for index in 0..node_count {
        let id = u32::try_from(index + 2).unwrap();
        commands.push(container(id));
        commands.push(Command::SetStyle {
            id,
            properties: if index == 0 && scenario.is_animation() {
                animated_properties(scenario, false)
            } else {
                static_properties()
            },
        });
        commands.push(insert(1, id));
    }
    tree.apply_commands(window_id, commands).unwrap();
    (Rc::new(RefCell::new(tree)), window_id)
}

fn set_animation_target(tree: &Rc<RefCell<NativeTree>>, window_id: WindowId, scenario: Scenario) {
    tree.borrow_mut()
        .apply_commands(
            window_id,
            vec![Command::SetStyle {
                id: 2,
                properties: animated_properties(scenario, true),
            }],
        )
        .unwrap();
}

fn percentile(samples: &[Duration], numerator: usize, denominator: usize) -> Duration {
    let mut samples = samples.to_vec();
    samples.sort_unstable();
    samples[((samples.len() - 1) * numerator) / denominator]
}

fn micros(duration: Duration) -> f64 {
    duration.as_secs_f64() * 1_000_000.0
}

fn report(scenario: Scenario, nodes: usize, samples: &[FrameSample], renders: usize) {
    let totals: Vec<_> = samples.iter().map(|sample| sample.total).collect();
    let draws: Vec<_> = samples.iter().map(|sample| sample.draw).collect();
    let present_hooks: Vec<_> = samples.iter().map(|sample| sample.present_hook).collect();
    let prepares: Vec<_> = samples.iter().map(|sample| sample.prepare).collect();
    let builds: Vec<_> = samples.iter().map(|sample| sample.build).collect();
    let rests: Vec<_> = samples
        .iter()
        .map(|sample| sample.gpui_draw_rest())
        .collect();
    println!(
        "RETEND_GPUI_BENCH scenario={} nodes={} samples={} renders={} total_median_us={:.1} total_p95_us={:.1} draw_median_us={:.1} test_present_hook_median_us={:.1} prepare_median_us={:.1} build_median_us={:.1} gpui_draw_rest_median_us={:.1}",
        scenario.name(),
        nodes,
        samples.len(),
        renders,
        micros(percentile(&totals, 1, 2)),
        micros(percentile(&totals, 95, 100)),
        micros(percentile(&draws, 1, 2)),
        micros(percentile(&present_hooks, 1, 2)),
        micros(percentile(&prepares, 1, 2)),
        micros(percentile(&builds, 1, 2)),
        micros(percentile(&rests, 1, 2)),
    );
}

fn run_scenario(cx: &mut TestAppContext, nodes: usize, scenario: Scenario) {
    let (tree, window_id) = build_tree(nodes, scenario);
    let timings = Rc::new(RenderTimings::default());
    let runtime = RuntimeStateRegistry::default();
    let (view, cx) = cx.add_window_view({
        let tree = tree.clone();
        let timings = timings.clone();
        move |_, _| BenchmarkView {
            tree,
            runtime,
            window_id,
            timings,
        }
    });

    if scenario.is_animation() {
        set_animation_target(&tree, window_id, scenario);
        view.update(cx, |_, cx| cx.notify());
    }

    let draw = |cx: &mut gpui::VisualTestContext| {
        let sample = draw_test_frame(cx);
        FrameSample {
            total: sample.total,
            draw: sample.draw,
            present_hook: sample.present_hook,
            prepare: timings.prepare.get(),
            build: timings.build.get(),
        }
    };

    for _ in 0..WARMUP_FRAMES {
        if scenario.is_animation() {
            cx.executor().advance_clock(FRAME_STEP);
        }
        let _ = draw(cx);
    }

    let renders_before = timings.renders.get();
    let mut samples = Vec::with_capacity(SAMPLE_FRAMES);
    for _ in 0..SAMPLE_FRAMES {
        if scenario.is_animation() {
            cx.executor().advance_clock(FRAME_STEP);
        }
        samples.push(draw(cx));
    }
    report(
        scenario,
        nodes,
        &samples,
        timings.renders.get() - renders_before,
    );
}

struct StaticIsland {
    nodes: usize,
    renders: Rc<Cell<usize>>,
}

impl Render for StaticIsland {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        self.renders.set(self.renders.get() + 1);
        div().children((0..self.nodes).map(|_| div().w(px(100.0)).h(px(1.0)).bg(rgb(0x336699))))
    }
}

struct AnimatedIsland {
    target: f32,
    renders: Rc<Cell<usize>>,
}

impl Render for AnimatedIsland {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        self.renders.set(self.renders.get() + 1);
        let opacity = gpui_base::transition(
            "benchmark-island-opacity",
            self.target,
            gpui_base::Transition::new(Duration::from_secs(10)),
            window,
            cx,
        );
        div()
            .w(px(100.0))
            .h(px(1.0))
            .bg(rgb(0x336699))
            .opacity(opacity)
    }
}

struct IslandRoot {
    static_island: Entity<StaticIsland>,
    animated_island: Entity<AnimatedIsland>,
    static_nodes: usize,
    renders: Rc<Cell<usize>>,
}

impl Render for IslandRoot {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        self.renders.set(self.renders.get() + 1);
        let mut cache_style = StyleRefinement::default();
        cache_style.size.width = Some(px(100.0).into());
        cache_style.size.height = Some(px(self.static_nodes as f32).into());
        let static_view = AnyView::from(self.static_island.clone()).cached(cache_style);
        div().child(static_view).child(self.animated_island.clone())
    }
}

fn run_cached_island(cx: &mut TestAppContext, nodes: usize) {
    let root_renders = Rc::new(Cell::new(0));
    let static_renders = Rc::new(Cell::new(0));
    let animated_renders = Rc::new(Cell::new(0));
    let (root, cx) = cx.add_window_view({
        let root_renders = root_renders.clone();
        let static_renders = static_renders.clone();
        let animated_renders = animated_renders.clone();
        move |_, cx| {
            let static_island = cx.new(|_| StaticIsland {
                nodes,
                renders: static_renders,
            });
            let animated_island = cx.new(|_| AnimatedIsland {
                target: 0.1,
                renders: animated_renders,
            });
            IslandRoot {
                static_island,
                animated_island,
                static_nodes: nodes,
                renders: root_renders,
            }
        }
    });

    let animated = root.update(cx, |root, _| root.animated_island.clone());
    animated.update(cx, |island, cx| {
        island.target = 0.9;
        cx.notify();
    });

    for _ in 0..WARMUP_FRAMES {
        cx.executor().advance_clock(FRAME_STEP);
        let _ = draw_test_frame(cx);
    }

    let root_before = root_renders.get();
    let static_before = static_renders.get();
    let animated_before = animated_renders.get();
    let mut totals = Vec::with_capacity(SAMPLE_FRAMES);
    let mut draws = Vec::with_capacity(SAMPLE_FRAMES);
    let mut present_hooks = Vec::with_capacity(SAMPLE_FRAMES);
    for _ in 0..SAMPLE_FRAMES {
        cx.executor().advance_clock(FRAME_STEP);
        let sample = draw_test_frame(cx);
        totals.push(sample.total);
        draws.push(sample.draw);
        present_hooks.push(sample.present_hook);
    }

    println!(
        "RETEND_GPUI_ISLAND nodes={} samples={} root_renders={} static_renders={} animated_renders={} total_median_us={:.1} draw_median_us={:.1} test_present_hook_median_us={:.1}",
        nodes,
        SAMPLE_FRAMES,
        root_renders.get() - root_before,
        static_renders.get() - static_before,
        animated_renders.get() - animated_before,
        micros(percentile(&totals, 1, 2)),
        micros(percentile(&draws, 1, 2)),
        micros(percentile(&present_hooks, 1, 2)),
    );
}

struct RetendStaticIsland {
    tree: Rc<RefCell<NativeTree>>,
    runtime: RuntimeStateRegistry,
    root_id: u32,
    renders: Rc<Cell<usize>>,
}

impl Render for RetendStaticIsland {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        self.renders.set(self.renders.get() + 1);
        let tree = self.tree.borrow();
        build_subtree_with_runtime(
            &tree,
            self.root_id,
            &self.runtime,
            self.runtime.current_generation(),
            window,
            cx,
        )
    }
}

struct RetendIslandRoot {
    tree: Rc<RefCell<NativeTree>>,
    runtime: RuntimeStateRegistry,
    window_id: WindowId,
    static_island: Entity<RetendStaticIsland>,
    animated_island: Entity<AnimatedIsland>,
    static_nodes: usize,
    renders: Rc<Cell<usize>>,
}

impl Render for RetendIslandRoot {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        self.renders.set(self.renders.get() + 1);
        let tree = self.tree.borrow();
        prepare_frame(&tree, &self.runtime, self.window_id, window, cx);

        let mut cache_style = StyleRefinement::default();
        cache_style.size.width = Some(px(100.0).into());
        cache_style.size.height = Some(px(self.static_nodes as f32).into());
        div()
            .child(AnyView::from(self.static_island.clone()).cached(cache_style))
            .child(self.animated_island.clone())
    }
}

fn build_retend_island_tree(nodes: usize) -> (Rc<RefCell<NativeTree>>, WindowId) {
    let mut tree = NativeTree::default();
    let window_id = tree.create_window(1).unwrap();
    let mut commands = Vec::with_capacity(nodes * 3 + 3);
    commands.push(container(2));
    commands.push(Command::SetStyle {
        id: 2,
        properties: vec![
            (PropertyId::Width, PropertyValue::Number(100.0)),
            (PropertyId::Height, PropertyValue::Number(nodes as f64)),
        ],
    });
    commands.push(insert(1, 2));
    for index in 0..nodes {
        let id = u32::try_from(index + 3).unwrap();
        commands.push(container(id));
        commands.push(Command::SetStyle {
            id,
            properties: static_properties(),
        });
        commands.push(insert(2, id));
    }
    tree.apply_commands(window_id, commands).unwrap();
    (Rc::new(RefCell::new(tree)), window_id)
}

fn run_retend_cached_island(cx: &mut TestAppContext, nodes: usize) {
    let (tree, window_id) = build_retend_island_tree(nodes);
    let runtime = RuntimeStateRegistry::default();
    let root_renders = Rc::new(Cell::new(0));
    let static_renders = Rc::new(Cell::new(0));
    let animated_renders = Rc::new(Cell::new(0));
    let (root, cx) = cx.add_window_view({
        let tree = tree.clone();
        let runtime = runtime.clone();
        let root_renders = root_renders.clone();
        let static_renders = static_renders.clone();
        let animated_renders = animated_renders.clone();
        move |_, cx| {
            let static_island = cx.new(|_| RetendStaticIsland {
                tree: tree.clone(),
                runtime: runtime.clone(),
                root_id: 2,
                renders: static_renders,
            });
            let animated_island = cx.new(|_| AnimatedIsland {
                target: 0.1,
                renders: animated_renders,
            });
            RetendIslandRoot {
                tree,
                runtime,
                window_id,
                static_island,
                animated_island,
                static_nodes: nodes,
                renders: root_renders,
            }
        }
    });

    let animated = root.update(cx, |root, _| root.animated_island.clone());
    animated.update(cx, |island, cx| {
        island.target = 0.9;
        cx.notify();
    });

    for _ in 0..WARMUP_FRAMES {
        cx.executor().advance_clock(FRAME_STEP);
        let _ = draw_test_frame(cx);
    }

    let root_before = root_renders.get();
    let static_before = static_renders.get();
    let animated_before = animated_renders.get();
    let mut totals = Vec::with_capacity(SAMPLE_FRAMES);
    let mut draws = Vec::with_capacity(SAMPLE_FRAMES);
    let mut present_hooks = Vec::with_capacity(SAMPLE_FRAMES);
    for _ in 0..SAMPLE_FRAMES {
        cx.executor().advance_clock(FRAME_STEP);
        let sample = draw_test_frame(cx);
        totals.push(sample.total);
        draws.push(sample.draw);
        present_hooks.push(sample.present_hook);
    }

    println!(
        "RETEND_GPUI_RETEND_ISLAND nodes={} samples={} root_renders={} static_renders={} animated_renders={} total_median_us={:.1} draw_median_us={:.1} test_present_hook_median_us={:.1}",
        nodes,
        SAMPLE_FRAMES,
        root_renders.get() - root_before,
        static_renders.get() - static_before,
        animated_renders.get() - animated_before,
        micros(percentile(&totals, 1, 2)),
        micros(percentile(&draws, 1, 2)),
        micros(percentile(&present_hooks, 1, 2)),
    );
}

static NEXT_PRODUCTION_ROOT: AtomicU32 = AtomicU32::new(0xe000_0000);

fn build_production_island_tree(nodes: usize, island_count: usize) -> (WindowId, Vec<u32>, u32) {
    assert!(island_count > 0 && nodes / island_count >= 64);
    let stride = 10_000;
    let root_id = NEXT_PRODUCTION_ROOT.fetch_add(stride, Ordering::Relaxed);
    let mut next_id = root_id + 1;
    let mut island_ids = Vec::with_capacity(island_count);
    let mut commands = Vec::with_capacity(nodes * 3 + island_count * 3 + 3);
    for island_index in 0..island_count {
        let island_id = next_id;
        next_id += 1;
        island_ids.push(island_id);
        let child_count = nodes / island_count + usize::from(island_index < nodes % island_count);
        commands.extend([
            container(island_id),
            Command::SetStyle {
                id: island_id,
                properties: vec![
                    (PropertyId::Width, PropertyValue::Number(100.0)),
                    (
                        PropertyId::Height,
                        PropertyValue::Number(child_count as f64),
                    ),
                ],
            },
            insert(root_id, island_id),
        ]);
        for _ in 0..child_count {
            let id = next_id;
            next_id += 1;
            commands.push(container(id));
            commands.push(Command::SetStyle {
                id,
                properties: static_properties(),
            });
            commands.push(insert(island_id, id));
        }
    }
    let animated_id = next_id;
    commands.extend([
        container(animated_id),
        Command::SetStyle {
            id: animated_id,
            properties: animated_properties(Scenario::Opacity, false),
        },
        insert(root_id, animated_id),
    ]);

    let mut tree = crate::runtime().lock().unwrap();
    let window_id = tree.create_window(root_id).unwrap();
    tree.apply_commands(window_id, commands).unwrap();
    (window_id, island_ids, animated_id)
}

fn run_production_cached_islands(cx: &mut TestAppContext, nodes: usize, island_count: usize) {
    let (window_id, island_ids, animated_id) = build_production_island_tree(nodes, island_count);
    let runtime = RuntimeStateRegistry::default();
    let (view, cx) = cx.add_window_view({
        let runtime = runtime.clone();
        move |_, _| benchmark_root_view(window_id, runtime)
    });

    // Establish initial GPUI/Retend presentation and the island cache.
    cx.update(|window, cx| window.draw(cx).clear(cx));
    crate::runtime()
        .lock()
        .unwrap()
        .apply_commands(
            window_id,
            vec![Command::SetStyle {
                id: animated_id,
                properties: animated_properties(Scenario::Opacity, true),
            }],
        )
        .unwrap();
    view.update(cx, |view, cx| {
        view.benchmark_invalidate_nodes(&[animated_id], cx)
    });

    for _ in 0..WARMUP_FRAMES {
        cx.executor().advance_clock(FRAME_STEP);
        let _ = draw_test_frame(cx);
    }
    let generations_before = view.update(cx, |view, _| {
        island_ids
            .iter()
            .map(|id| view.benchmark_island_generation(*id).unwrap())
            .collect::<Vec<_>>()
    });
    let mut totals = Vec::with_capacity(SAMPLE_FRAMES);
    let mut draws = Vec::with_capacity(SAMPLE_FRAMES);
    let mut present_hooks = Vec::with_capacity(SAMPLE_FRAMES);
    for _ in 0..SAMPLE_FRAMES {
        cx.executor().advance_clock(FRAME_STEP);
        let sample = draw_test_frame(cx);
        totals.push(sample.total);
        draws.push(sample.draw);
        present_hooks.push(sample.present_hook);
    }
    let generations_after = view.update(cx, |view, _| {
        island_ids
            .iter()
            .map(|id| view.benchmark_island_generation(*id).unwrap())
            .collect::<Vec<_>>()
    });
    println!(
        "RETEND_GPUI_PRODUCTION_ISLAND nodes={} islands={} samples={} island_rerendered={} total_median_us={:.1} draw_median_us={:.1} test_present_hook_median_us={:.1}",
        nodes,
        island_count,
        SAMPLE_FRAMES,
        generations_after != generations_before,
        micros(percentile(&totals, 1, 2)),
        micros(percentile(&draws, 1, 2)),
        micros(percentile(&present_hooks, 1, 2)),
    );

    cx.update(|window, _| window.remove_window());
    crate::runtime().lock().unwrap().close_window(window_id);
}

fn print_phase_profile(label: &str, nodes: usize, samples: &[PhaseSample]) {
    let draws: Vec<_> = samples.iter().map(|sample| sample.draw).collect();
    let present_hooks: Vec<_> = samples.iter().map(|sample| sample.present_hook).collect();
    let requests: Vec<_> = samples.iter().map(|sample| sample.request).collect();
    let layouts: Vec<_> = samples.iter().map(|sample| sample.layout).collect();
    let prepaints: Vec<_> = samples.iter().map(|sample| sample.prepaint).collect();
    let paints: Vec<_> = samples.iter().map(|sample| sample.paint).collect();
    let residuals: Vec<_> = samples.iter().map(|sample| sample.residual).collect();
    println!(
        "RETEND_GPUI_PHASES scenario={} nodes={} samples={} draw_median_us={:.1} request_median_us={:.1} layout_median_us={:.1} prepaint_median_us={:.1} paint_median_us={:.1} residual_median_us={:.1} test_present_hook_median_us={:.1}",
        label,
        nodes,
        samples.len(),
        micros(percentile(&draws, 1, 2)),
        micros(percentile(&requests, 1, 2)),
        micros(percentile(&layouts, 1, 2)),
        micros(percentile(&prepaints, 1, 2)),
        micros(percentile(&paints, 1, 2)),
        micros(percentile(&residuals, 1, 2)),
        micros(percentile(&present_hooks, 1, 2)),
    );
}

fn run_production_phase_profile(cx: &mut TestAppContext, nodes: usize) {
    let (window_id, _island_ids, animated_id) = build_production_island_tree(nodes, 1);
    let runtime = RuntimeStateRegistry::default();
    let timings = Rc::new(PhaseTimings::default());
    let (host, cx) = cx.add_window_view({
        let timings = timings.clone();
        move |_, cx| {
            let inner = cx.new({
                let runtime = runtime.clone();
                move |_| benchmark_root_view(window_id, runtime)
            });
            ProfiledView {
                inner_id: inner.entity_id(),
                inner: AnyView::from(inner),
                timings,
            }
        }
    });

    cx.update(|window, cx| window.draw(cx).clear(cx));
    crate::runtime()
        .lock()
        .unwrap()
        .apply_commands(
            window_id,
            vec![Command::SetStyle {
                id: animated_id,
                properties: animated_properties(Scenario::Opacity, true),
            }],
        )
        .unwrap();
    let inner_id = host.update(cx, |host, _| host.inner_id);
    cx.update(|_, cx| cx.notify(inner_id));

    for _ in 0..WARMUP_FRAMES {
        cx.executor().advance_clock(FRAME_STEP);
        let _ = draw_test_frame(cx);
    }

    let mut samples = Vec::with_capacity(SAMPLE_FRAMES);
    for _ in 0..SAMPLE_FRAMES {
        cx.executor().advance_clock(FRAME_STEP);
        samples.push(PhaseSample::capture(draw_test_frame(cx), &timings));
    }

    print_phase_profile("cached-opacity", nodes, &samples);

    cx.update(|window, _| window.remove_window());
    crate::runtime().lock().unwrap().close_window(window_id);
}

fn run_flat_phase_profile(cx: &mut TestAppContext, nodes: usize, scenario: Scenario) {
    let (tree, window_id) = build_tree(nodes, scenario);
    let runtime = RuntimeStateRegistry::default();
    let render_timings = Rc::new(RenderTimings::default());
    let timings = Rc::new(PhaseTimings::default());
    let (host, cx) = cx.add_window_view({
        let tree = tree.clone();
        let render_timings = render_timings.clone();
        let timings = timings.clone();
        move |_, cx| {
            let inner = cx.new({
                let tree = tree.clone();
                let runtime = runtime.clone();
                let render_timings = render_timings.clone();
                move |_| BenchmarkView {
                    tree,
                    runtime,
                    window_id,
                    timings: render_timings,
                }
            });
            ProfiledView {
                inner_id: inner.entity_id(),
                inner: AnyView::from(inner),
                timings,
            }
        }
    });

    cx.update(|window, cx| window.draw(cx).clear(cx));
    if scenario.is_animation() {
        set_animation_target(&tree, window_id, scenario);
        let inner_id = host.update(cx, |host, _| host.inner_id);
        cx.update(|_, cx| cx.notify(inner_id));
    }

    for _ in 0..WARMUP_FRAMES {
        if scenario.is_animation() {
            cx.executor().advance_clock(FRAME_STEP);
        }
        let _ = draw_test_frame(cx);
    }

    let mut samples = Vec::with_capacity(SAMPLE_FRAMES);
    for _ in 0..SAMPLE_FRAMES {
        if scenario.is_animation() {
            cx.executor().advance_clock(FRAME_STEP);
        }
        samples.push(PhaseSample::capture(draw_test_frame(cx), &timings));
    }

    print_phase_profile(scenario.name(), nodes, &samples);
}

#[gpui::test]
fn benchmark(cx: &mut TestAppContext) {
    println!("RETEND_GPUI_BENCH cpu_only=true columns=total,draw,test_present_hook,prepare_frame,build_with_runtime,gpui_draw_rest(draw-prepare-build)");
    for nodes in [100, 1_000, 5_000] {
        for scenario in [Scenario::StaticRedraw, Scenario::Opacity, Scenario::Width] {
            run_scenario(cx, nodes, scenario);
        }
        run_cached_island(cx, nodes);
        run_retend_cached_island(cx, nodes);
        run_production_cached_islands(cx, nodes, 1);
    }
    for islands in [5, 20, 50] {
        run_production_cached_islands(cx, 5_000, islands);
    }
    run_production_phase_profile(cx, 5_000);
    run_flat_phase_profile(cx, 5_000, Scenario::Opacity);
    run_flat_phase_profile(cx, 5_000, Scenario::Width);
}
