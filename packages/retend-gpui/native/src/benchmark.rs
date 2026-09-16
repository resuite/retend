use std::{
    cell::{Cell, RefCell},
    rc::Rc,
    time::{Duration, Instant},
};

use gpui::{
    div, prelude::*, px, rgb, AnyElement, AnyView, App, Bounds, Context, Element, ElementId,
    Entity, EntityId, GlobalElementId, InspectorElementId, LayoutId, Pixels, Render, Style,
    StyleRefinement, TestAppContext, Window,
};

use crate::{
    platform::prepare_frame,
    protocol::{Command, PropertyValue},
    protocol_generated::{ElementKind, PropertyId},
    render::build_with_runtime,
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

#[derive(Clone, Copy)]
struct DrawSample {
    total: Duration,
    draw: Duration,
    present_hook: Duration,
}

fn draw_frame(cx: &mut gpui::VisualTestContext) -> DrawSample {
    let started = Instant::now();
    let draw = Cell::new(Duration::ZERO);
    let present_hook = Cell::new(Duration::ZERO);
    cx.update(|window, cx| {
        let draw_started = Instant::now();
        let arena = window.draw(cx);
        draw.set(draw_started.elapsed());

        let present_started = Instant::now();
        // TestAppContext has no native renderer. This is only CPU test-platform
        // hook overhead, not GPU submission, swap, or display latency.
        window.present_if_needed();
        present_hook.set(present_started.elapsed());
        arena.clear(cx);
    });
    DrawSample {
        total: started.elapsed(),
        draw: draw.get(),
        present_hook: present_hook.get(),
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

fn build_tree(nodes: usize, scenario: Scenario) -> (Rc<RefCell<NativeTree>>, WindowId) {
    let mut tree = NativeTree::default();
    let window_id = tree.create_window(1).unwrap();
    let mut commands = Vec::with_capacity(nodes * 3);
    for index in 0..nodes {
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

fn set_animation_target(
    tree: &Rc<RefCell<NativeTree>>,
    window_id: WindowId,
    scenario: Scenario,
) {
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

fn run_flat(cx: &mut TestAppContext, nodes: usize, scenario: Scenario) {
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

    for _ in 0..WARMUP_FRAMES {
        if scenario.is_animation() {
            cx.executor().advance_clock(FRAME_STEP);
        }
        let _ = draw_frame(cx);
    }

    let renders_before = timings.renders.get();
    let mut totals = Vec::with_capacity(SAMPLE_FRAMES);
    let mut draws = Vec::with_capacity(SAMPLE_FRAMES);
    let mut present_hooks = Vec::with_capacity(SAMPLE_FRAMES);
    let mut prepares = Vec::with_capacity(SAMPLE_FRAMES);
    let mut builds = Vec::with_capacity(SAMPLE_FRAMES);
    for _ in 0..SAMPLE_FRAMES {
        if scenario.is_animation() {
            cx.executor().advance_clock(FRAME_STEP);
        }
        let sample = draw_frame(cx);
        totals.push(sample.total);
        draws.push(sample.draw);
        present_hooks.push(sample.present_hook);
        prepares.push(timings.prepare.get());
        builds.push(timings.build.get());
    }

    println!(
        "RETEND_GPUI_BENCH scenario={} nodes={} samples={} renders={} total_median_us={:.1} draw_median_us={:.1} prepare_median_us={:.1} build_median_us={:.1} test_present_hook_median_us={:.1}",
        scenario.name(),
        nodes,
        SAMPLE_FRAMES,
        timings.renders.get() - renders_before,
        micros(percentile(&totals, 1, 2)),
        micros(percentile(&draws, 1, 2)),
        micros(percentile(&prepares, 1, 2)),
        micros(percentile(&builds, 1, 2)),
        micros(percentile(&present_hooks, 1, 2)),
    );
}

struct StaticScene {
    nodes: usize,
    renders: Rc<Cell<usize>>,
}

impl Render for StaticScene {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        self.renders.set(self.renders.get() + 1);
        div().children((0..self.nodes).map(|_| {
            div()
                .w(px(100.0))
                .h(px(1.0))
                .bg(rgb(0x336699))
        }))
    }
}

struct AnimatedMarker {
    target: f32,
}

impl Render for AnimatedMarker {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let opacity = gpui_base::transition(
            "benchmark-replay-opacity",
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

struct ReplayRoot {
    static_scene: Entity<StaticScene>,
    animated: Entity<AnimatedMarker>,
    nodes: usize,
}

impl Render for ReplayRoot {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        let mut style = StyleRefinement::default();
        style.size.width = Some(px(100.0).into());
        style.size.height = Some(px(self.nodes as f32).into());
        div()
            .child(AnyView::from(self.static_scene.clone()).cached(style))
            .child(self.animated.clone())
    }
}

fn replay_root(
    nodes: usize,
    renders: Rc<Cell<usize>>,
    cx: &mut Context<ProfiledReplayView>,
) -> Entity<ReplayRoot> {
    let static_scene = cx.new(|_| StaticScene { nodes, renders });
    let animated = cx.new(|_| AnimatedMarker { target: 0.1 });
    cx.new(|_| ReplayRoot {
        static_scene,
        animated,
        nodes,
    })
}

struct ProfiledReplayView {
    inner: Option<Entity<ReplayRoot>>,
    nodes: usize,
    static_renders: Rc<Cell<usize>>,
    timings: Rc<PhaseTimings>,
}

impl Render for ProfiledReplayView {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let inner = self.inner.get_or_insert_with(|| {
            replay_root(self.nodes, self.static_renders.clone(), cx)
        });
        PhaseHarness {
            inner: AnyView::from(inner.clone()).into_any_element(),
            timings: self.timings.clone(),
        }
    }
}

fn run_replay_isolation(cx: &mut TestAppContext, nodes: usize) {
    let static_renders = Rc::new(Cell::new(0));
    let timings = Rc::new(PhaseTimings::default());
    let (host, cx) = cx.add_window_view({
        let static_renders = static_renders.clone();
        let timings = timings.clone();
        move |_, _| ProfiledReplayView {
            inner: None,
            nodes,
            static_renders,
            timings,
        }
    });

    // First draw constructs and paints the static scene.
    cx.update(|window, cx| window.draw(cx).clear(cx));
    let animated = host.update(cx, |host, cx| {
        host.inner
            .as_ref()
            .expect("first draw must initialize replay root")
            .read(cx)
            .animated
            .clone()
    });
    animated.update(cx, |animated, cx| {
        animated.target = 0.9;
        cx.notify();
    });

    for _ in 0..WARMUP_FRAMES {
        cx.executor().advance_clock(FRAME_STEP);
        let _ = draw_frame(cx);
    }

    let renders_before = static_renders.get();
    let mut draws = Vec::with_capacity(SAMPLE_FRAMES);
    let mut requests = Vec::with_capacity(SAMPLE_FRAMES);
    let mut layouts = Vec::with_capacity(SAMPLE_FRAMES);
    let mut prepaints = Vec::with_capacity(SAMPLE_FRAMES);
    let mut paints = Vec::with_capacity(SAMPLE_FRAMES);
    for _ in 0..SAMPLE_FRAMES {
        cx.executor().advance_clock(FRAME_STEP);
        let sample = draw_frame(cx);
        draws.push(sample.draw);
        requests.push(timings.request_layout.get());
        layouts.push(timings.layout.get());
        prepaints.push(timings.prepaint.get());
        paints.push(timings.paint.get());
    }

    println!(
        "RETEND_GPUI_REPLAY_ISOLATION nodes={} samples={} static_rerenders={} draw_median_us={:.1} request_median_us={:.1} layout_median_us={:.1} prepaint_median_us={:.1} paint_median_us={:.1}",
        nodes,
        SAMPLE_FRAMES,
        static_renders.get() - renders_before,
        micros(percentile(&draws, 1, 2)),
        micros(percentile(&requests, 1, 2)),
        micros(percentile(&layouts, 1, 2)),
        micros(percentile(&prepaints, 1, 2)),
        micros(percentile(&paints, 1, 2)),
    );
}

fn run_flat_phase_profile(cx: &mut TestAppContext, nodes: usize, scenario: Scenario) {
    let (tree, window_id) = build_tree(nodes, scenario);
    let runtime = RuntimeStateRegistry::default();
    let render_timings = Rc::new(RenderTimings::default());
    let phase_timings = Rc::new(PhaseTimings::default());
    let (host, cx) = cx.add_window_view({
        let tree = tree.clone();
        let render_timings = render_timings.clone();
        let phase_timings = phase_timings.clone();
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
                timings: phase_timings,
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
        let _ = draw_frame(cx);
    }

    let mut draws = Vec::with_capacity(SAMPLE_FRAMES);
    let mut requests = Vec::with_capacity(SAMPLE_FRAMES);
    let mut layouts = Vec::with_capacity(SAMPLE_FRAMES);
    let mut prepaints = Vec::with_capacity(SAMPLE_FRAMES);
    let mut paints = Vec::with_capacity(SAMPLE_FRAMES);
    for _ in 0..SAMPLE_FRAMES {
        if scenario.is_animation() {
            cx.executor().advance_clock(FRAME_STEP);
        }
        let sample = draw_frame(cx);
        draws.push(sample.draw);
        requests.push(phase_timings.request_layout.get());
        layouts.push(phase_timings.layout.get());
        prepaints.push(phase_timings.prepaint.get());
        paints.push(phase_timings.paint.get());
    }

    println!(
        "RETEND_GPUI_PHASES scenario={} nodes={} samples={} draw_median_us={:.1} request_median_us={:.1} layout_median_us={:.1} prepaint_median_us={:.1} paint_median_us={:.1}",
        scenario.name(),
        nodes,
        SAMPLE_FRAMES,
        micros(percentile(&draws, 1, 2)),
        micros(percentile(&requests, 1, 2)),
        micros(percentile(&layouts, 1, 2)),
        micros(percentile(&prepaints, 1, 2)),
        micros(percentile(&paints, 1, 2)),
    );
}

#[gpui::test]
fn benchmark(cx: &mut TestAppContext) {
    println!("RETEND_GPUI_BENCH cpu_only=true; test_present_hook is not GPU presentation");
    for nodes in [100, 1_000, 5_000] {
        for scenario in [Scenario::StaticRedraw, Scenario::Opacity, Scenario::Width] {
            run_flat(cx, nodes, scenario);
        }
        run_replay_isolation(cx, nodes);
    }
    run_flat_phase_profile(cx, 5_000, Scenario::Opacity);
    run_flat_phase_profile(cx, 5_000, Scenario::Width);
}
