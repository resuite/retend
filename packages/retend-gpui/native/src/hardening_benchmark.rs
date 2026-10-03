//! Headless CPU profiles, selected with `hardening_benchmark` and feature `benchmarks`.
//!
//! Native test arguments: `--release --features benchmarks hardening_benchmark --
//! --nocapture --test-threads=1`. The workspace runner owns the build and invocation.
//! Optional environment: RETEND_GPUI_HARDENING_SIZES=100,1000,5000,
//! RETEND_GPUI_HARDENING_ITERATIONS=100, RETEND_GPUI_HARDENING_WARMUP=10.
//!
//! No GPUI application, test window, N-API binding, or global runtime is created.
//! `RetendRootView::render` holds the runtime mutex through preparation and element
//! construction. Its macOS deferred dispatch and Linux/Windows UI-thread queue are
//! deliberately not simulated here. Uncontended lock times cannot establish UI
//! contention or justify changing production synchronization.

use std::{
    hint::black_box,
    sync::Mutex,
    time::{Duration, Instant},
};

use crate::{
    protocol::{decode_command_batch, Command, PropertyValue, HEADER_BYTES},
    protocol_generated::{
        ElementKind, Opcode, PropertyId, ValueKind, PROTOCOL_MAGIC, PROTOCOL_VERSION,
    },
    style::{LengthValue, NativeStyle},
    tree::{NativeTree, NodeId, WindowId},
};

struct Config {
    sizes: Vec<usize>,
    iterations: usize,
    warmup: usize,
}

impl Config {
    fn from_env() -> Self {
        fn number(name: &str, default: usize, min: usize, max: usize) -> usize {
            let value = match std::env::var(name) {
                Ok(value) => value.parse().unwrap_or_else(|_| panic!("invalid {name}")),
                Err(std::env::VarError::NotPresent) => default,
                Err(error) => panic!("invalid {name}: {error}"),
            };
            assert!((min..=max).contains(&value), "{name} must be {min}..={max}");
            value
        }

        let sizes = match std::env::var("RETEND_GPUI_HARDENING_SIZES") {
            Ok(value) => value
                .split(',')
                .map(|part| {
                    let size = part
                        .trim()
                        .parse::<usize>()
                        .expect("invalid benchmark size");
                    assert!((1..=50_000).contains(&size), "size must be 1..=50000");
                    size
                })
                .collect(),
            Err(std::env::VarError::NotPresent) => vec![100, 1_000, 5_000],
            Err(error) => panic!("invalid RETEND_GPUI_HARDENING_SIZES: {error}"),
        };
        Self {
            sizes,
            iterations: number("RETEND_GPUI_HARDENING_ITERATIONS", 100, 1, 100_000),
            warmup: number("RETEND_GPUI_HARDENING_WARMUP", 10, 0, 10_000),
        }
    }
}

struct Samples(Vec<Duration>);

impl Samples {
    fn new(config: &Config) -> Self {
        Self(Vec::with_capacity(config.iterations))
    }

    fn record(&mut self, config: &Config, iteration: usize, elapsed: Duration) {
        if iteration >= config.warmup {
            self.0.push(elapsed);
        }
    }

    fn report(&mut self, scenario: &str, phase: &str, nodes: usize, config: &Config) {
        self.0.sort_unstable();
        let percentile = |percent: usize| self.0[(self.0.len() * percent).div_ceil(100) - 1];
        let micros = |duration: Duration| duration.as_secs_f64() * 1_000_000.0;
        let mean =
            self.0.iter().map(|duration| micros(*duration)).sum::<f64>() / self.0.len() as f64;
        println!(
            "RETEND_GPUI_HARDENING scope=headless scenario={scenario} phase={phase} nodes={nodes} samples={} warmup={} p50_us={:.3} p95_us={:.3} p99_us={:.3} min_us={:.3} max_us={:.3} mean_us={mean:.3}",
            self.0.len(), config.warmup, micros(percentile(50)), micros(percentile(95)),
            micros(percentile(99)), micros(self.0[0]), micros(self.0[self.0.len() - 1]),
        );
    }
}

fn node_id(index: usize) -> NodeId {
    u32::try_from(index + 2).expect("benchmark node ID fits u32")
}

fn properties(alternate: bool) -> Vec<(PropertyId, PropertyValue)> {
    vec![
        (
            PropertyId::Width,
            PropertyValue::Number(if alternate { 120.0 } else { 100.0 }),
        ),
        (PropertyId::Height, PropertyValue::Number(24.0)),
        (
            PropertyId::Opacity,
            PropertyValue::Number(if alternate { 0.75 } else { 1.0 }),
        ),
        (PropertyId::Padding, PropertyValue::Number(4.0)),
        (PropertyId::BorderRadius, PropertyValue::Number(3.0)),
        (PropertyId::FontSize, PropertyValue::Number(14.0)),
        (PropertyId::Display, PropertyValue::String("flex".into())),
        (
            PropertyId::FontFamily,
            PropertyValue::String("benchmark-font".into()),
        ),
    ]
}

fn mount_commands(nodes: usize) -> Vec<Command> {
    let mut commands = Vec::with_capacity(nodes * 3);
    for index in 0..nodes {
        let id = node_id(index);
        commands.push(Command::CreateNode {
            id,
            kind: ElementKind::Container,
        });
        commands.push(Command::SetStyle {
            id,
            properties: properties(false),
        });
        commands.push(Command::InsertChild {
            parent_id: 1,
            child_id: id,
            before_id: 0,
        });
    }
    commands
}

fn style_commands(nodes: usize, repeats: usize, alternate: bool) -> Vec<Command> {
    let mut commands = Vec::with_capacity(nodes * repeats);
    // Multiple full snapshots of the same node exercise apply_commands' final
    // author-target resolution, rather than pretending each write is a frame.
    for repeat in 0..repeats {
        for index in 0..nodes {
            commands.push(Command::SetStyle {
                id: node_id(index),
                properties: properties(if repeat + 1 == repeats {
                    alternate
                } else {
                    !alternate
                }),
            });
        }
    }
    commands
}

struct Batch {
    bytes: Vec<u8>,
    commands: usize,
}

impl Batch {
    fn new(commands: Vec<Command>) -> Self {
        // This fixture encoder supports only the commands used below. All wire
        // discriminants come from the generated schema; decoding is production.
        let mut body = Vec::new();
        let mut strings: Vec<&str> = Vec::new();
        for command in &commands {
            match command {
                Command::CreateNode { id, kind } => {
                    body.push(Opcode::CreateNode as u8);
                    body.extend(id.to_le_bytes());
                    body.push(*kind as u8);
                }
                Command::InsertChild {
                    parent_id,
                    child_id,
                    before_id,
                } => {
                    body.push(Opcode::InsertChild as u8);
                    body.extend(parent_id.to_le_bytes());
                    body.extend(child_id.to_le_bytes());
                    body.extend(before_id.to_le_bytes());
                }
                Command::SetStyle { id, properties } => {
                    body.push(Opcode::SetStyle as u8);
                    body.extend(id.to_le_bytes());
                    body.extend(
                        u16::try_from(properties.len())
                            .expect("property count")
                            .to_le_bytes(),
                    );
                    for (property, value) in properties {
                        body.extend((*property as u16).to_le_bytes());
                        match value {
                            PropertyValue::Number(value) => {
                                body.push(ValueKind::Number as u8);
                                body.extend(value.to_le_bytes());
                            }
                            PropertyValue::String(value) => {
                                body.push(ValueKind::String as u8);
                                let index = strings
                                    .iter()
                                    .position(|string| *string == value)
                                    .unwrap_or_else(|| {
                                        strings.push(value);
                                        strings.len() - 1
                                    });
                                body.extend(
                                    u32::try_from(index).expect("string index").to_le_bytes(),
                                );
                            }
                            _ => panic!("unsupported benchmark property value"),
                        }
                    }
                }
                _ => panic!("unsupported benchmark command"),
            }
        }
        let mut bytes = Vec::new();
        bytes.extend(PROTOCOL_MAGIC.to_le_bytes());
        bytes.extend(PROTOCOL_VERSION.to_le_bytes());
        bytes.extend(0_u16.to_le_bytes());
        for value in [
            body.len(),
            commands.len(),
            HEADER_BYTES + body.len(),
            strings.len(),
        ] {
            bytes.extend(
                u32::try_from(value)
                    .expect("batch header fits u32")
                    .to_le_bytes(),
            );
        }
        bytes.extend(body);
        for string in strings {
            bytes.extend(
                u32::try_from(string.len())
                    .expect("string length")
                    .to_le_bytes(),
            );
            bytes.extend(string.as_bytes());
        }
        assert_eq!(
            decode_command_batch(&bytes).expect("fixture must decode"),
            commands
        );
        Self {
            bytes,
            commands: commands.len(),
        }
    }
}

fn empty_tree() -> (NativeTree, WindowId) {
    let mut tree = NativeTree::default();
    let window = tree.create_window(1).expect("benchmark root is unused");
    (tree, window)
}

fn populated_tree(nodes: usize) -> (NativeTree, WindowId) {
    let (mut tree, window) = empty_tree();
    tree.apply_commands(window, mount_commands(nodes))
        .expect("valid mount fixture");
    (tree, window)
}

fn assert_style(tree: &NativeTree, id: NodeId, alternate: bool) {
    let style = tree.nodes[&id].style.as_deref().expect("resolved style");
    assert_eq!(
        style.width,
        Some(LengthValue::Pixels(if alternate { 120.0 } else { 100.0 }))
    );
}

fn run_batches(
    config: &Config,
    nodes: usize,
    scenario: &str,
    updated_nodes: usize,
    repeats: usize,
) {
    let mounting = scenario == "mount";
    let batches = if mounting {
        vec![Batch::new(mount_commands(nodes))]
    } else {
        vec![
            Batch::new(style_commands(updated_nodes, repeats, false)),
            Batch::new(style_commands(updated_nodes, repeats, true)),
        ]
    };
    println!(
        "RETEND_GPUI_HARDENING_WORKLOAD scenario={scenario} nodes={nodes} root_nodes=1 updated_nodes={updated_nodes} snapshots_per_node={repeats} properties_per_snapshot=8 commands={} bytes={} topology=flat",
        batches[0].commands, batches[0].bytes.len(),
    );
    let (tree, window) = if mounting {
        empty_tree()
    } else {
        populated_tree(nodes)
    };
    let tree = Mutex::new(tree);
    let mut decode = Samples::new(config);
    let mut acquire = Samples::new(config);
    let mut apply = Samples::new(config);
    let mut total = Samples::new(config);
    for iteration in 0..config.warmup + config.iterations {
        if mounting {
            // Both fresh-tree setup and destruction of the previous tree are untimed.
            let (fresh, fresh_window) = empty_tree();
            assert_eq!(fresh_window, window);
            *tree.lock().expect("benchmark mutex") = fresh;
        }
        let batch = &batches[iteration % batches.len()];
        let started = Instant::now();
        let commands = decode_command_batch(black_box(&batch.bytes)).expect("valid wire batch");
        let decoded = Instant::now();
        let mut guard = tree.lock().expect("benchmark mutex");
        let acquired = Instant::now();
        guard
            .apply_commands(window, black_box(commands))
            .expect("valid application");
        let applied = Instant::now();
        drop(guard);
        let elapsed = started.elapsed();
        decode.record(config, iteration, decoded.duration_since(started));
        acquire.record(config, iteration, acquired.duration_since(decoded));
        apply.record(config, iteration, applied.duration_since(acquired));
        total.record(config, iteration, elapsed);

        let guard = tree.lock().expect("benchmark mutex");
        assert_eq!(guard.nodes.len(), nodes + 1);
        assert_eq!(guard.nodes[&1].children.len(), nodes);
        assert!(guard.windows[&window].fatal.is_none());
        let alternate = !mounting && iteration % 2 == 1;
        assert_style(&guard, node_id(0), alternate);
        assert_style(&guard, node_id(updated_nodes - 1), alternate);
    }
    decode.report(scenario, "decode", nodes, config);
    acquire.report(scenario, "uncontended_lock_acquire", nodes, config);
    apply.report(scenario, "apply_lock_held", nodes, config);
    total.report(scenario, "decode_apply_unlock", nodes, config);
}

// A deliberately partial, benchmark-only owned snapshot. Production borrows the
// tree; it does not clone these records. Motion, events, focus, and runtime entities
// are excluded, so this is a copy-cost experiment, not an alternative renderer.
struct StyleSnapshot {
    id: NodeId,
    children: Vec<NodeId>,
    style: Option<Box<NativeStyle>>,
}

fn read_style(id: NodeId, children: &[NodeId], style: Option<&NativeStyle>) -> usize {
    black_box(id);
    black_box(children);
    if let Some(style) = style {
        // Exercise the production mapping to GPUI styles without a Window or App.
        // This includes element creation/destruction, but no layout or painting.
        black_box(style.apply(gpui::div()));
    }
    children.len()
}

fn read_retained(tree: &NativeTree, nodes: usize) -> usize {
    (1..=node_id(nodes - 1))
        .map(|id| {
            let node = &tree.nodes[&id];
            read_style(id, &node.children, node.style.as_deref())
        })
        .sum()
}

fn copy_styles(tree: &NativeTree, nodes: usize) -> Vec<StyleSnapshot> {
    (1..=node_id(nodes - 1))
        .map(|id| {
            let node = &tree.nodes[&id];
            StyleSnapshot {
                id,
                children: node.children.clone(),
                style: node.style.clone(),
            }
        })
        .collect()
}

fn run_retained(config: &Config, nodes: usize, copied: bool) {
    let scenario = if copied {
        "experimental_style_snapshot"
    } else {
        "retained_locked_style_read"
    };
    let (tree, window) = populated_tree(nodes);
    let tree = Mutex::new(tree);
    let batches = [
        Batch::new(style_commands(nodes, 1, false)),
        Batch::new(style_commands(nodes, 1, true)),
    ];
    println!(
        "RETEND_GPUI_HARDENING_WORKLOAD scenario={scenario} nodes={nodes} root_nodes=1 updates_per_sample={nodes} topology=flat mutex=local_uncontended style_mapping=production snapshot=structure_and_resolved_styles_only"
    );
    let mut acquire = Samples::new(config);
    let mut held = Samples::new(config);
    let mut consume = Samples::new(config);
    let mut total = Samples::new(config);
    for iteration in 0..config.warmup + config.iterations {
        // Same full-tree invalidation before each strategy, outside its timer.
        let commands =
            decode_command_batch(&batches[iteration % 2].bytes).expect("valid style batch");
        tree.lock()
            .expect("benchmark mutex")
            .apply_commands(window, commands)
            .expect("valid style update");

        let started = Instant::now();
        let guard = tree.lock().expect("benchmark mutex");
        let acquired = Instant::now();
        let (edges, held_time, consume_time) = if copied {
            let snapshot = black_box(copy_styles(&guard, nodes));
            drop(guard);
            let released = Instant::now();
            let edges: usize = snapshot
                .iter()
                .map(|node| read_style(node.id, &node.children, node.style.as_deref()))
                .sum();
            // Include owned snapshot destruction in post-unlock and total cost.
            drop(snapshot);
            (edges, released.duration_since(acquired), released.elapsed())
        } else {
            let edges = black_box(read_retained(&guard, nodes));
            drop(guard);
            (edges, acquired.elapsed(), Duration::ZERO)
        };
        let elapsed = started.elapsed();
        acquire.record(config, iteration, acquired.duration_since(started));
        held.record(config, iteration, held_time);
        consume.record(config, iteration, consume_time);
        total.record(config, iteration, elapsed);
        assert_eq!(edges, nodes);
    }
    acquire.report(scenario, "uncontended_lock_acquire", nodes, config);
    held.report(scenario, "lock_held_through_unlock", nodes, config);
    if copied {
        consume.report(
            scenario,
            "post_unlock_style_mapping_and_drop",
            nodes,
            config,
        );
    }
    total.report(scenario, "total", nodes, config);
}

#[test]
fn hardening_benchmark() {
    let config = Config::from_env();
    println!(
        "RETEND_GPUI_HARDENING_META scope=headless os={} arch={} debug_assertions={} sizes={:?} iterations={} warmup={} percentile=nearest_rank argv={:?}",
        std::env::consts::OS, std::env::consts::ARCH, cfg!(debug_assertions),
        config.sizes, config.iterations, config.warmup, std::env::args_os().collect::<Vec<_>>(),
    );
    println!(
        "RETEND_GPUI_HARDENING_SCOPE no_windows=true no_napi=true no_layout=true no_paint=true no_gpu=true no_ui_dispatch=true no_contention=true; local Mutex<NativeTree> matches the runtime lock type; snapshot comparison is experimental, not production render timing"
    );
    println!(
        "RETEND_GPUI_HARDENING_TIMING fixture_encoding_and_tree_setup=excluded decode_allocations=included command_destruction_in_apply=included style_updates_before_retained_reads=excluded timer_overhead=not_subtracted; use release, a single test thread, and repeated process runs; p99 with fewer than 100 samples is only a rough tail indicator"
    );
    for &nodes in &config.sizes {
        run_batches(&config, nodes, "mount", nodes, 1);
        run_batches(&config, nodes, "style_single_node", 1, 1);
        run_batches(&config, nodes, "style_full_tree", nodes, 1);
        run_batches(&config, nodes, "style_full_tree_burst", nodes, 4);
        run_retained(&config, nodes, false);
        run_retained(&config, nodes, true);
    }
}
