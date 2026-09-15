use std::{cell::Cell, time::Duration};

use gpui::{App, ElementId, Hsla, Rgba, Window};
use gpui_base::{transition, transition_with_status, Interpolate, MotionStatus, Transition};

use crate::{
    protocol::PropertyValue,
    protocol_generated::{NativeEventId, PropertyId},
    style::{LengthValue, NativeStyle},
    tree::NodeId,
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum AnimatableProperty {
    Width,
    Height,
    Top,
    Right,
    Bottom,
    Left,
    Opacity,
    BorderRadius,
    BackgroundColor,
    Color,
}

impl AnimatableProperty {
    const ALL: [Self; 10] = [
        Self::Width,
        Self::Height,
        Self::Top,
        Self::Right,
        Self::Bottom,
        Self::Left,
        Self::Opacity,
        Self::BorderRadius,
        Self::BackgroundColor,
        Self::Color,
    ];

    fn bit(self) -> u16 {
        1 << self as u16
    }

    fn parse(value: &str) -> Option<Self> {
        match value.trim() {
            "width" => Some(Self::Width),
            "height" => Some(Self::Height),
            "top" => Some(Self::Top),
            "right" => Some(Self::Right),
            "bottom" => Some(Self::Bottom),
            "left" => Some(Self::Left),
            "opacity" => Some(Self::Opacity),
            "borderRadius" => Some(Self::BorderRadius),
            "backgroundColor" => Some(Self::BackgroundColor),
            "color" => Some(Self::Color),
            _ => None,
        }
    }

    fn channel(self) -> &'static str {
        match self {
            Self::Width => "width",
            Self::Height => "height",
            Self::Top => "top",
            Self::Right => "right",
            Self::Bottom => "bottom",
            Self::Left => "left",
            Self::Opacity => "opacity",
            Self::BorderRadius => "border-radius",
            Self::BackgroundColor => "background-color",
            Self::Color => "color",
        }
    }

    fn author_name(self) -> &'static str {
        match self {
            Self::Width => "width",
            Self::Height => "height",
            Self::Top => "top",
            Self::Right => "right",
            Self::Bottom => "bottom",
            Self::Left => "left",
            Self::Opacity => "opacity",
            Self::BorderRadius => "borderRadius",
            Self::BackgroundColor => "backgroundColor",
            Self::Color => "color",
        }
    }

    fn target(self, style: &NativeStyle) -> TransitionValue {
        let pixels = |value| match value {
            Some(LengthValue::Pixels(value)) => TransitionValue::Value(value),
            _ => TransitionValue::Unset,
        };
        let color = |value: Option<u32>| {
            value.map_or(TransitionValue::Unset, |value| {
                TransitionValue::Color(Hsla::from(gpui::rgba(value)))
            })
        };
        match self {
            Self::Width => pixels(style.width),
            Self::Height => pixels(style.height),
            Self::Top => pixels(style.top),
            Self::Right => pixels(style.right),
            Self::Bottom => pixels(style.bottom),
            Self::Left => pixels(style.left),
            Self::Opacity => style.opacity.map_or(TransitionValue::Unset, TransitionValue::Value),
            Self::BorderRadius => style
                .border_radius
                .map_or(TransitionValue::Unset, TransitionValue::Value),
            Self::BackgroundColor => color(style.background_color),
            Self::Color => color(style.color),
        }
    }

    fn apply(self, style: &mut NativeStyle, value: TransitionValue) {
        match (self, value) {
            (Self::BackgroundColor, TransitionValue::Color(value)) => {
                style.background_color = Some(u32::from(Rgba::from(value)));
            }
            (Self::Color, TransitionValue::Color(value)) => {
                style.color = Some(u32::from(Rgba::from(value)));
            }
            (property, TransitionValue::Value(value)) => match property {
                Self::Width => style.width = Some(LengthValue::Pixels(value)),
                Self::Height => style.height = Some(LengthValue::Pixels(value)),
                Self::Top => style.top = Some(LengthValue::Pixels(value)),
                Self::Right => style.right = Some(LengthValue::Pixels(value)),
                Self::Bottom => style.bottom = Some(LengthValue::Pixels(value)),
                Self::Left => style.left = Some(LengthValue::Pixels(value)),
                Self::Opacity => style.opacity = Some(value),
                Self::BorderRadius => style.border_radius = Some(value),
                Self::BackgroundColor | Self::Color => {}
            },
            _ => {}
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum TransitionValue {
    Unset,
    Value(f32),
    Color(Hsla),
}

impl Interpolate for TransitionValue {
    fn interpolate(&self, target: &Self, progress: f32) -> Self {
        match (*self, *target) {
            (Self::Value(from), Self::Value(to)) => {
                Self::Value(from + (to - from) * progress)
            }
            (Self::Color(from), Self::Color(to)) => Self::Color(from.interpolate(&to, progress)),
            (_, target) => target,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
struct Bezier([f32; 4]);

impl Bezier {
    const EASE: Self = Self([0.25, 0.1, 0.25, 1.0]);

    fn parse(value: &PropertyValue) -> Option<Self> {
        let PropertyValue::String(value) = value else {
            return None;
        };
        let value = value.trim().to_ascii_lowercase();
        let named = match value.as_str() {
            "linear" => Some([0.0, 0.0, 1.0, 1.0]),
            "ease" => Some([0.25, 0.1, 0.25, 1.0]),
            "ease-in" => Some([0.42, 0.0, 1.0, 1.0]),
            "ease-out" => Some([0.0, 0.0, 0.58, 1.0]),
            "ease-in-out" => Some([0.42, 0.0, 0.58, 1.0]),
            _ => None,
        };
        if let Some(points) = named {
            return Some(Self(points));
        }

        let arguments = value.strip_prefix("cubic-bezier(")?.strip_suffix(')')?;
        let mut values = arguments.split(',').map(|part| part.trim().parse::<f32>());
        let points = [
            values.next()?.ok()?,
            values.next()?.ok()?,
            values.next()?.ok()?,
            values.next()?.ok()?,
        ];
        if values.next().is_some()
            || points.iter().any(|value| !value.is_finite())
            || !(0.0..=1.0).contains(&points[0])
            || !(0.0..=1.0).contains(&points[2])
        {
            return None;
        }
        Some(Self(points))
    }
}

#[derive(Clone, Copy, Debug)]
pub struct TransitionSpec {
    properties: u16,
    duration: Option<Duration>,
    delay: Option<Duration>,
    easing: Option<Bezier>,
}

impl Default for TransitionSpec {
    fn default() -> Self {
        Self {
            properties: 0,
            duration: Some(Duration::ZERO),
            delay: Some(Duration::ZERO),
            easing: Some(Bezier::EASE),
        }
    }
}

impl TransitionSpec {
    pub fn supports_property(property: PropertyId) -> bool {
        matches!(
            property,
            PropertyId::TransitionProperty
                | PropertyId::TransitionDuration
                | PropertyId::TransitionDelay
                | PropertyId::TransitionTimingFunction
        )
    }

    pub fn set_property(&mut self, property: PropertyId, value: &PropertyValue) -> bool {
        match property {
            PropertyId::TransitionProperty => self.properties = parse_transition_properties(value),
            PropertyId::TransitionDuration => self.duration = parse_time(value, false),
            PropertyId::TransitionDelay => self.delay = parse_time(value, true),
            PropertyId::TransitionTimingFunction => self.easing = Bezier::parse(value),
            _ => return false,
        }
        true
    }

    /// Validates the shared timing longhands once; they are not per-property.
    fn config(self) -> Option<TransitionConfig> {
        Some(TransitionConfig {
            duration: self.duration?,
            delay: self.delay?,
            easing: self.easing?,
        })
    }
}

fn parse_transition_properties(value: &PropertyValue) -> u16 {
    let PropertyValue::String(value) = value else {
        return 0;
    };
    let mut properties = 0;
    for value in value.split(',') {
        let Some(property) = AnimatableProperty::parse(value) else {
            return 0;
        };
        properties |= property.bit();
    }
    properties
}

fn parse_time(value: &PropertyValue, clamp_negative: bool) -> Option<Duration> {
    let PropertyValue::String(value) = value else {
        return None;
    };
    let value = value.trim();
    let (number, multiplier) = if let Some(number) = value.strip_suffix("ms") {
        (number, 0.001)
    } else if let Some(number) = value.strip_suffix('s') {
        (number, 1.0)
    } else {
        return None;
    };
    let mut seconds = parse_js_number(number.trim())? * multiplier;
    if !seconds.is_finite() {
        return None;
    }
    if seconds < 0.0 {
        if !clamp_negative {
            return None;
        }
        seconds = 0.0;
    }
    Duration::try_from_secs_f64(seconds).ok()
}

fn parse_js_number(value: &str) -> Option<f64> {
    if value.is_empty() {
        return None;
    }
    for (prefixes, radix) in [(["0x", "0X"], 16), (["0b", "0B"], 2), (["0o", "0O"], 8)] {
        if let Some(digits) = prefixes.iter().find_map(|prefix| value.strip_prefix(prefix)) {
            return u64::from_str_radix(digits, radix)
                .ok()
                .map(|value| value as f64);
        }
    }
    value.parse().ok()
}

#[derive(Clone, Copy, Debug)]
struct TransitionConfig {
    duration: Duration,
    delay: Duration,
    easing: Bezier,
}

#[derive(Clone, Copy, Debug)]
struct ActiveLifecycle {
    config: TransitionConfig,
    started: bool,
}

#[derive(Debug)]
pub(crate) struct MotionBridgeState {
    initialized: Cell<bool>,
    previous_targets: Cell<[TransitionValue; 10]>,
    active_mask: Cell<u16>,
    lifecycles: Cell<[Option<ActiveLifecycle>; 10]>,
}

impl Default for MotionBridgeState {
    fn default() -> Self {
        Self {
            initialized: Cell::new(false),
            previous_targets: Cell::new([TransitionValue::Unset; 10]),
            active_mask: Cell::new(0),
            lifecycles: Cell::new([None; 10]),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct TransitionLifecycleEvent {
    pub event: NativeEventId,
    pub property_index: usize,
    pub elapsed: f64,
}

impl TransitionLifecycleEvent {
    pub fn property_name(self) -> &'static str {
        AnimatableProperty::ALL[self.property_index].author_name()
    }
}

fn emit(
    events: &mut Vec<TransitionLifecycleEvent>,
    event: NativeEventId,
    index: usize,
    elapsed: f64,
) {
    events.push(TransitionLifecycleEvent {
        event,
        property_index: index,
        elapsed,
    });
}

fn begin_lifecycle(
    events: &mut Vec<TransitionLifecycleEvent>,
    index: usize,
    sampled: TransitionValue,
    target: TransitionValue,
    status: MotionStatus,
    config: TransitionConfig,
) -> Option<ActiveLifecycle> {
    if sampled == target {
        return None;
    }
    match status {
        MotionStatus::Delayed => {
            emit(events, NativeEventId::TransitionRun, index, 0.0);
            Some(ActiveLifecycle {
                config,
                started: false,
            })
        }
        MotionStatus::Running => {
            emit(events, NativeEventId::TransitionRun, index, 0.0);
            emit(
                events,
                NativeEventId::TransitionStart,
                index,
                config.delay.as_secs_f64(),
            );
            Some(ActiveLifecycle {
                config,
                started: true,
            })
        }
        MotionStatus::Idle | MotionStatus::Finished => None,
    }
}

fn reconcile_lifecycle(
    events: &mut Vec<TransitionLifecycleEvent>,
    index: usize,
    lifecycle: ActiveLifecycle,
    status: MotionStatus,
    forced_snap: bool,
) -> Option<ActiveLifecycle> {
    if forced_snap {
        emit(events, NativeEventId::TransitionCancel, index, 0.0);
        return None;
    }
    match status {
        MotionStatus::Delayed => Some(lifecycle),
        MotionStatus::Running if !lifecycle.started => {
            emit(
                events,
                NativeEventId::TransitionStart,
                index,
                lifecycle.config.delay.as_secs_f64(),
            );
            Some(ActiveLifecycle {
                started: true,
                ..lifecycle
            })
        }
        MotionStatus::Running => Some(lifecycle),
        MotionStatus::Finished => {
            if !lifecycle.started {
                emit(
                    events,
                    NativeEventId::TransitionStart,
                    index,
                    lifecycle.config.delay.as_secs_f64(),
                );
            }
            emit(
                events,
                NativeEventId::TransitionEnd,
                index,
                lifecycle.config.duration.as_secs_f64(),
            );
            None
        }
        // This state can only follow a no-op retarget. It must not leave a
        // previously emitted run open indefinitely.
        MotionStatus::Idle => {
            emit(events, NativeEventId::TransitionCancel, index, 0.0);
            None
        }
    }
}

fn settle_lifecycle(
    events: &mut Vec<TransitionLifecycleEvent>,
    index: usize,
    property: AnimatableProperty,
    element_id: &ElementId,
    target: TransitionValue,
    lifecycle: ActiveLifecycle,
    window: &mut Window,
    cx: &mut App,
) -> Option<ActiveLifecycle> {
    let sampled = transition_with_status(
        (element_id.clone(), property.channel()),
        target,
        transition_policy(lifecycle.config),
        window,
        cx,
    );
    reconcile_lifecycle(events, index, lifecycle, sampled.status, cx.reduce_motion())
}

fn eligible_mask(transition: TransitionSpec, targets: &[TransitionValue; 10]) -> u16 {
    AnimatableProperty::ALL
        .into_iter()
        .filter(|property| {
            transition.properties & property.bit() != 0
                && targets[*property as usize] != TransitionValue::Unset
        })
        .fold(0, |mask, property| mask | property.bit())
}

fn transition_policy(config: TransitionConfig) -> Transition {
    // GPUI snaps zero-duration transitions before consulting their delay. Retend's
    // CSS-style API still honors a non-zero delay, so use the smallest positive
    // duration and let GPUI own the delayed playback and frame scheduling.
    let duration = if config.duration.is_zero() && !config.delay.is_zero() {
        Duration::from_nanos(1)
    } else {
        config.duration
    };
    let [x1, y1, x2, y2] = config.easing.0;
    Transition::new(duration)
        .delay(config.delay)
        .ease(gpui_base::animation::cubic_bezier(x1, y1, x2, y2))
}

pub fn resolve_style(
    node_id: NodeId,
    state: &MotionBridgeState,
    author: Option<&NativeStyle>,
    window: &mut Window,
    cx: &mut App,
) -> (Option<NativeStyle>, Vec<TransitionLifecycleEvent>) {
    let element_id = ElementId::Integer(u64::from(node_id));
    let previous_targets = state.previous_targets.get();
    let previous_lifecycles = state.lifecycles.get();
    let mut lifecycles = previous_lifecycles;
    let mut events = Vec::new();

    let Some(target_style) = author else {
        for (index, property) in AnimatableProperty::ALL.into_iter().enumerate() {
            if let Some(lifecycle) = lifecycles[index] {
                let still_active = settle_lifecycle(
                    &mut events,
                    index,
                    property,
                    &element_id,
                    previous_targets[index],
                    lifecycle,
                    window,
                    cx,
                );
                if still_active.is_some() {
                    emit(&mut events, NativeEventId::TransitionCancel, index, 0.0);
                }
            }
        }
        state
            .previous_targets
            .set([TransitionValue::Unset; AnimatableProperty::ALL.len()]);
        state.active_mask.set(0);
        state.lifecycles.set([None; 10]);
        state.initialized.set(true);
        return (None, events);
    };

    let spec = target_style.transition;
    let targets = AnimatableProperty::ALL.map(|property| property.target(target_style));
    let config = spec.config();
    let current_mask = config
        .filter(|_| spec.properties != 0)
        .map_or(0, |_| eligible_mask(spec, &targets));
    let previous_mask = state.active_mask.replace(current_mask);
    let initialized = state.initialized.replace(true);

    let Some(config) = config.filter(|_| current_mask != 0) else {
        for (index, property) in AnimatableProperty::ALL.into_iter().enumerate() {
            if let Some(lifecycle) = lifecycles[index] {
                let still_active = settle_lifecycle(
                    &mut events,
                    index,
                    property,
                    &element_id,
                    previous_targets[index],
                    lifecycle,
                    window,
                    cx,
                );
                if still_active.is_some() {
                    emit(&mut events, NativeEventId::TransitionCancel, index, 0.0);
                }
            }
        }
        state.previous_targets.set(targets);
        state.lifecycles.set([None; 10]);
        return (None, events);
    };

    let mut resolved = None;
    for (index, property) in AnimatableProperty::ALL.into_iter().enumerate() {
        let target = targets[index];
        let key = (element_id.clone(), property.channel());
        let previous_target = previous_targets[index];
        let previously_eligible = previous_mask & property.bit() != 0;
        let currently_eligible = current_mask & property.bit() != 0;
        let target_changed = previous_target != target;

        if !currently_eligible {
            if let Some(lifecycle) = lifecycles[index] {
                let still_active = settle_lifecycle(
                    &mut events,
                    index,
                    property,
                    &element_id,
                    previous_target,
                    lifecycle,
                    window,
                    cx,
                );
                if still_active.is_some() {
                    emit(&mut events, NativeEventId::TransitionCancel, index, 0.0);
                }
            }
            lifecycles[index] = None;
            continue;
        }

        if !initialized {
            let sampled =
                transition_with_status(key, target, transition_policy(config), window, cx);
            if sampled.value != target {
                property.apply(
                    resolved.get_or_insert_with(|| target_style.clone()),
                    sampled.value,
                );
            }
            lifecycles[index] = None;
            continue;
        }

        if !previously_eligible {
            // Seed newly enabled channels from the last committed author target so
            // values do not resume stale GPUI motion. An Unset previous target has
            // no representable start value, so snap the channel to the current
            // target with a zero-duration policy and emit nothing.
            if previous_target == TransitionValue::Unset {
                transition(key, target, Transition::new(Duration::ZERO), window, cx);
                lifecycles[index] = None;
                continue;
            }
            transition(
                key.clone(),
                previous_target,
                Transition::new(Duration::ZERO),
                window,
                cx,
            );
            let sampled =
                transition_with_status(key, target, transition_policy(config), window, cx);
            if sampled.value != target {
                property.apply(
                    resolved.get_or_insert_with(|| target_style.clone()),
                    sampled.value,
                );
            }
            lifecycles[index] = begin_lifecycle(
                &mut events,
                index,
                sampled.value,
                target,
                sampled.status,
                config,
            );
            continue;
        }

        if target_changed {
            if let Some(lifecycle) = lifecycles[index] {
                let still_active = settle_lifecycle(
                    &mut events,
                    index,
                    property,
                    &element_id,
                    previous_target,
                    lifecycle,
                    window,
                    cx,
                );
                if still_active.is_some() {
                    emit(&mut events, NativeEventId::TransitionCancel, index, 0.0);
                }
            }
            let sampled =
                transition_with_status(key, target, transition_policy(config), window, cx);
            if sampled.value != target {
                property.apply(
                    resolved.get_or_insert_with(|| target_style.clone()),
                    sampled.value,
                );
            }
            lifecycles[index] = begin_lifecycle(
                &mut events,
                index,
                sampled.value,
                target,
                sampled.status,
                config,
            );
            continue;
        }

        let policy = lifecycles[index].map_or(config, |lifecycle| lifecycle.config);
        let sampled = transition_with_status(key, target, transition_policy(policy), window, cx);
        if sampled.value != target {
            property.apply(
                resolved.get_or_insert_with(|| target_style.clone()),
                sampled.value,
            );
        }
        lifecycles[index] = lifecycles[index].and_then(|lifecycle| {
            reconcile_lifecycle(
                &mut events,
                index,
                lifecycle,
                sampled.status,
                cx.reduce_motion(),
            )
        });
    }
    state.previous_targets.set(targets);
    state.lifecycles.set(lifecycles);
    (resolved, events)
}

#[cfg(test)]
mod tests {
    use std::{cell::Cell, rc::Rc};

    use gpui::{div, AppContext, Context, Render, TestAppContext};

    use super::*;

    struct MotionProbe {
        target: f32,
        enabled: bool,
        sampled: Rc<Cell<f32>>,
        motion: MotionBridgeState,
    }

    impl Render for MotionProbe {
        fn render(
            &mut self,
            window: &mut Window,
            cx: &mut Context<Self>,
        ) -> impl gpui::IntoElement {
            let style = transition_style(self.target, self.enabled);
            let (resolved, _) = resolve_style(1, &self.motion, Some(&style), window, cx);
            let resolved = resolved.unwrap_or(style);
            let Some(LengthValue::Pixels(width)) = resolved.width else {
                panic!("motion probe width must remain pixel-valued");
            };
            self.sampled.set(width);
            div()
        }
    }

    fn transition_style(width: f32, enabled: bool) -> NativeStyle {
        let mut style = NativeStyle::default();
        assert!(style.set_property(PropertyId::Width, &PropertyValue::Number(width.into())));
        if enabled {
            assert!(style.set_property(
                PropertyId::TransitionProperty,
                &PropertyValue::String("width".into()),
            ));
            assert!(style.set_property(
                PropertyId::TransitionDuration,
                &PropertyValue::String("200ms".into()),
            ));
            assert!(style.set_property(
                PropertyId::TransitionTimingFunction,
                &PropertyValue::String("linear".into()),
            ));
        }
        style
    }

    fn draw<V: Render>(cx: &mut TestAppContext, window: gpui::WindowHandle<V>) {
        cx.update_window(window.into(), |_, window, cx| window.draw(cx).clear(cx))
            .unwrap();
    }

    #[test]
    fn parses_css_style_transition_configuration_fail_soft() {
        let mut transition = TransitionSpec::default();
        assert!(transition.set_property(
            PropertyId::TransitionProperty,
            &PropertyValue::String("width, opacity,width".into()),
        ));
        assert!(transition.properties & AnimatableProperty::Width.bit() != 0);
        assert!(transition.properties & AnimatableProperty::Opacity.bit() != 0);
        assert!(transition.config().is_some());
        assert!(transition.set_property(
            PropertyId::TransitionDuration,
            &PropertyValue::String(".2s".into()),
        ));
        assert_eq!(
            transition.config().unwrap().duration,
            Duration::from_millis(200)
        );
        assert!(transition.set_property(
            PropertyId::TransitionDelay,
            &PropertyValue::String("-20ms".into()),
        ));
        assert_eq!(transition.config().unwrap().delay, Duration::ZERO);
        transition.set_property(
            PropertyId::TransitionTimingFunction,
            &PropertyValue::String("cubic-bezier(0.16, 1, 0.3, 1)".into()),
        );
        assert!(transition.config().is_some());

        transition.set_property(
            PropertyId::TransitionDuration,
            &PropertyValue::String("banana".into()),
        );
        assert!(
            transition.config().is_none(),
            "an invalid duration must fail soft rather than panicking"
        );

        transition.set_property(
            PropertyId::TransitionDuration,
            &PropertyValue::String("200ms".into()),
        );
        transition.set_property(
            PropertyId::TransitionProperty,
            &PropertyValue::String("all".into()),
        );
        assert_eq!(
            transition.properties, 0,
            "the CSS `all` keyword must not enable any property"
        );
    }

    #[gpui::test]
    fn gpui_owns_initial_adoption_and_interrupted_retargeting(cx: &mut TestAppContext) {
        let sampled = Rc::new(Cell::new(-1.0));
        let window = cx.add_window({
            let sampled = sampled.clone();
            move |_, _| MotionProbe {
                target: 0.0,
                enabled: true,
                sampled,
                motion: MotionBridgeState::default(),
            }
        });
        assert_eq!(sampled.get(), 0.0, "the first target must not transition");

        window
            .update(cx, |probe, _, cx| {
                probe.target = 100.0;
                cx.notify();
            })
            .unwrap();
        draw(cx, window);
        assert_eq!(sampled.get(), 0.0);

        cx.executor().advance_clock(Duration::from_millis(100));
        draw(cx, window);
        assert!((sampled.get() - 50.0).abs() < 0.01);

        window
            .update(cx, |probe, _, cx| {
                probe.target = 200.0;
                cx.notify();
            })
            .unwrap();
        draw(cx, window);
        assert!((sampled.get() - 50.0).abs() < 0.01);

        cx.executor().advance_clock(Duration::from_millis(100));
        draw(cx, window);
        assert!((sampled.get() - 125.0).abs() < 0.01);
    }

    #[gpui::test]
    fn removing_eligibility_reseeds_and_reduced_motion_snaps_through_gpui(cx: &mut TestAppContext) {
        let sampled = Rc::new(Cell::new(-1.0));
        let window = cx.add_window({
            let sampled = sampled.clone();
            move |_, _| MotionProbe {
                target: 0.0,
                enabled: true,
                sampled,
                motion: MotionBridgeState::default(),
            }
        });

        window
            .update(cx, |probe, _, cx| {
                probe.target = 100.0;
                cx.notify();
            })
            .unwrap();
        draw(cx, window);
        cx.executor().advance_clock(Duration::from_millis(50));
        draw(cx, window);
        assert!(sampled.get() > 0.0 && sampled.get() < 100.0);

        window
            .update(cx, |probe, _, cx| {
                probe.enabled = false;
                cx.notify();
            })
            .unwrap();
        draw(cx, window);
        assert_eq!(sampled.get(), 100.0);

        window
            .update(cx, |probe, _, cx| {
                probe.enabled = true;
                probe.target = 200.0;
                cx.notify();
            })
            .unwrap();
        draw(cx, window);
        assert_eq!(
            sampled.get(),
            100.0,
            "newly enabling a transition must seed GPUI from the last rendered author target"
        );
        cx.executor().advance_clock(Duration::from_millis(100));
        draw(cx, window);
        assert!((sampled.get() - 150.0).abs() < 0.01);

        cx.update(|cx| cx.set_reduce_motion(true));
        window
            .update(cx, |probe, _, cx| {
                probe.target = 300.0;
                cx.notify();
            })
            .unwrap();
        draw(cx, window);
        assert_eq!(sampled.get(), 300.0);
    }

    #[test]
    fn representable_targets_cover_the_supported_property_set() {
        let mut style = NativeStyle::default();
        for (property, value) in [
            (PropertyId::Width, 10.0),
            (PropertyId::Height, 20.0),
            (PropertyId::Top, 30.0),
            (PropertyId::Right, 40.0),
            (PropertyId::Bottom, 50.0),
            (PropertyId::Left, 60.0),
            (PropertyId::Opacity, 0.5),
            (PropertyId::BorderRadius, 70.0),
        ] {
            assert!(style.set_property(property, &PropertyValue::Number(value)));
        }
        for (property, value) in [
            (PropertyId::BackgroundColor, "#112233"),
            (PropertyId::Color, "#445566"),
        ] {
            assert!(style.set_property(property, &PropertyValue::String(value.into())));
        }
        assert!(AnimatableProperty::ALL
            .into_iter()
            .all(|property| property.target(&style) != TransitionValue::Unset));
    }

    struct ColorProbe {
        background: &'static str,
        sampled: Rc<Cell<u32>>,
        motion: MotionBridgeState,
    }

    impl Render for ColorProbe {
        fn render(
            &mut self,
            window: &mut Window,
            cx: &mut Context<Self>,
        ) -> impl gpui::IntoElement {
            let style = color_transition_style(self.background);
            let (resolved, _) = resolve_style(3, &self.motion, Some(&style), window, cx);
            let resolved = resolved.unwrap_or(style);
            self.sampled.set(resolved.background_color.unwrap_or(0));
            div()
        }
    }

    fn color_transition_style(background: &str) -> NativeStyle {
        let mut style = NativeStyle::default();
        assert!(style.set_property(
            PropertyId::BackgroundColor,
            &PropertyValue::String(background.into()),
        ));
        assert!(style.set_property(
            PropertyId::TransitionProperty,
            &PropertyValue::String("backgroundColor".into()),
        ));
        assert!(style.set_property(
            PropertyId::TransitionDuration,
            &PropertyValue::String("200ms".into()),
        ));
        assert!(style.set_property(
            PropertyId::TransitionTimingFunction,
            &PropertyValue::String("linear".into()),
        ));
        style
    }

    #[gpui::test]
    fn color_channels_transition_through_gpui_interpolation(cx: &mut TestAppContext) {
        let sampled = Rc::new(Cell::new(0));
        let window = cx.add_window({
            let sampled = sampled.clone();
            move |_, _| ColorProbe {
                background: "#000000",
                sampled,
                motion: MotionBridgeState::default(),
            }
        });
        assert_eq!(
            sampled.get(),
            0x000000ff,
            "the first target must not transition"
        );

        window
            .update(cx, |probe, _, cx| {
                probe.background = "#ffffff";
                cx.notify();
            })
            .unwrap();
        draw(cx, window);
        assert_eq!(sampled.get(), 0x000000ff);

        cx.executor().advance_clock(Duration::from_millis(100));
        draw(cx, window);
        let flight = sampled.get();
        let [red, green, blue, alpha] = flight.to_be_bytes();
        assert!(
            red == green && green == blue,
            "black-to-white must interpolate along the gray axis, got {flight:#010x}"
        );
        assert!(
            (0x40..=0xc0).contains(&red),
            "a mid-flight background must be partially interpolated, got {flight:#010x}"
        );
        assert_eq!(alpha, 0xff);

        cx.executor().advance_clock(Duration::from_millis(100));
        draw(cx, window);
        assert_eq!(sampled.get(), 0xffffffff);
    }

    #[derive(Clone, Copy, Debug, PartialEq)]
    enum SampledWidth {
        Pixels(f32),
        Percent(f32),
        Unset,
    }

    struct EndpointProbe {
        width: PropertyValue,
        sampled: Rc<Cell<SampledWidth>>,
        motion: MotionBridgeState,
    }

    impl Render for EndpointProbe {
        fn render(
            &mut self,
            window: &mut Window,
            cx: &mut Context<Self>,
        ) -> impl gpui::IntoElement {
            let mut style = transition_style(0.0, true);
            assert!(style.set_property(PropertyId::Width, &self.width));
            let (resolved, _) = resolve_style(2, &self.motion, Some(&style), window, cx);
            let resolved = resolved.unwrap_or(style);
            self.sampled.set(match resolved.width {
                Some(LengthValue::Pixels(value)) => SampledWidth::Pixels(value),
                Some(LengthValue::Percent(value)) => SampledWidth::Percent(value),
                _ => SampledWidth::Unset,
            });
            div()
        }
    }

    #[gpui::test]
    fn unsupported_endpoints_reset_the_gpui_transition_channel(cx: &mut TestAppContext) {
        let sampled = Rc::new(Cell::new(SampledWidth::Unset));
        let window = cx.add_window({
            let sampled = sampled.clone();
            move |_, _| EndpointProbe {
                width: PropertyValue::Number(0.0),
                sampled,
                motion: MotionBridgeState::default(),
            }
        });

        window
            .update(cx, |probe, _, cx| {
                probe.width = PropertyValue::Number(100.0);
                cx.notify();
            })
            .unwrap();
        cx.update_window(window.into(), |_, window, cx| window.draw(cx).clear(cx))
            .unwrap();
        cx.executor().advance_clock(Duration::from_millis(50));
        cx.update_window(window.into(), |_, window, cx| window.draw(cx).clear(cx))
            .unwrap();
        assert!(
            matches!(sampled.get(), SampledWidth::Pixels(value) if value > 0.0 && value < 100.0)
        );

        window
            .update(cx, |probe, _, cx| {
                probe.width = PropertyValue::String("50%".into());
                cx.notify();
            })
            .unwrap();
        cx.update_window(window.into(), |_, window, cx| window.draw(cx).clear(cx))
            .unwrap();
        assert_eq!(sampled.get(), SampledWidth::Percent(50.0));

        window
            .update(cx, |probe, _, cx| {
                probe.width = PropertyValue::Number(200.0);
                cx.notify();
            })
            .unwrap();
        cx.update_window(window.into(), |_, window, cx| window.draw(cx).clear(cx))
            .unwrap();
        assert_eq!(
            sampled.get(),
            SampledWidth::Pixels(200.0),
            "a representable target after an unsupported endpoint must not resume stale motion"
        );
    }

    struct LifecycleProbe {
        target: f32,
        enabled: bool,
        delay: Option<String>,
        duration: Option<String>,
        events: Rc<std::cell::RefCell<Vec<(NativeEventId, &'static str, f64)>>>,
        motion: MotionBridgeState,
    }

    impl Render for LifecycleProbe {
        fn render(
            &mut self,
            window: &mut Window,
            cx: &mut Context<Self>,
        ) -> impl gpui::IntoElement {
            let mut style = transition_style(self.target, self.enabled);
            if let Some(delay) = &self.delay {
                assert!(style.set_property(
                    PropertyId::TransitionDelay,
                    &PropertyValue::String(delay.clone()),
                ));
            }
            if let Some(duration) = &self.duration {
                assert!(style.set_property(
                    PropertyId::TransitionDuration,
                    &PropertyValue::String(duration.clone()),
                ));
            }
            let (resolved, lifecycle) = resolve_style(3, &self.motion, Some(&style), window, cx);
            for event in lifecycle {
                self.events
                    .borrow_mut()
                    .push((event.event, event.property_name(), event.elapsed));
            }
            let resolved = resolved.unwrap_or(style);
            let Some(LengthValue::Pixels(_)) = resolved.width else {
                panic!("lifecycle probe width must remain pixel-valued");
            };
            div()
        }
    }

    fn drain(
        events: &Rc<std::cell::RefCell<Vec<(NativeEventId, &'static str, f64)>>>,
    ) -> Vec<(NativeEventId, &'static str, f64)> {
        std::mem::take(&mut *events.borrow_mut())
    }

    fn kinds(
        events: &Rc<std::cell::RefCell<Vec<(NativeEventId, &'static str, f64)>>>,
    ) -> Vec<(NativeEventId, &'static str)> {
        drain(events)
            .into_iter()
            .map(|(event, name, _)| (event, name))
            .collect()
    }

    #[gpui::test]
    fn transition_lifecycle_emits_run_start_end_and_cancel(cx: &mut TestAppContext) {
        use NativeEventId as E;
        let events = Rc::new(std::cell::RefCell::new(Vec::new()));
        let window = cx.add_window({
            let events = events.clone();
            move |_, _| LifecycleProbe {
                target: 0.0,
                enabled: true,
                delay: None,
                duration: None,
                events,
                motion: MotionBridgeState::default(),
            }
        });
        // Initial mount adopts without events.
        assert!(kinds(&events).is_empty());

        window
            .update(cx, |probe, _, cx| {
                probe.target = 100.0;
                cx.notify();
            })
            .unwrap();
        draw(cx, window);
        assert_eq!(
            kinds(&events),
            vec![(E::TransitionRun, "width"), (E::TransitionStart, "width")],
            "a new target must emit run then start without delay"
        );

        // Retargeting an active transition cancels the previous run.
        window
            .update(cx, |probe, _, cx| {
                probe.target = 200.0;
                cx.notify();
            })
            .unwrap();
        draw(cx, window);
        assert_eq!(
            kinds(&events),
            vec![
                (E::TransitionCancel, "width"),
                (E::TransitionRun, "width"),
                (E::TransitionStart, "width"),
            ],
            "retargeting must cancel before running the replacement"
        );

        cx.executor().advance_clock(Duration::from_millis(300));
        draw(cx, window);
        let completed = drain(&events);
        assert_eq!(
            completed
                .iter()
                .map(|(event, name, _)| (*event, *name))
                .collect::<Vec<_>>(),
            vec![(E::TransitionEnd, "width")],
            "completion must emit end once"
        );
        assert!(
            (completed[0].2 - 0.2).abs() < 1e-6,
            "end must report the stored 200ms duration, got {}",
            completed[0].2
        );
        draw(cx, window);
        assert!(
            kinds(&events).is_empty(),
            "a finished transition must not re-emit end"
        );

        // Removing eligibility while running cancels and snaps.
        window
            .update(cx, |probe, _, cx| {
                probe.target = 300.0;
                cx.notify();
            })
            .unwrap();
        draw(cx, window);
        assert_eq!(
            kinds(&events),
            vec![(E::TransitionRun, "width"), (E::TransitionStart, "width")],
        );
        window
            .update(cx, |probe, _, cx| {
                probe.enabled = false;
                cx.notify();
            })
            .unwrap();
        draw(cx, window);
        assert_eq!(kinds(&events), vec![(E::TransitionCancel, "width")]);
    }

    #[gpui::test]
    fn transition_delay_separates_run_and_start(cx: &mut TestAppContext) {
        use NativeEventId as E;
        let events = Rc::new(std::cell::RefCell::new(Vec::new()));
        let window = cx.add_window({
            let events = events.clone();
            move |_, _| LifecycleProbe {
                target: 0.0,
                enabled: true,
                delay: Some("200ms".to_string()),
                duration: None,
                events,
                motion: MotionBridgeState::default(),
            }
        });
        assert!(kinds(&events).is_empty());

        window
            .update(cx, |probe, _, cx| {
                probe.target = 100.0;
                cx.notify();
            })
            .unwrap();
        draw(cx, window);
        assert_eq!(kinds(&events), vec![(E::TransitionRun, "width")]);

        cx.executor().advance_clock(Duration::from_millis(200));
        draw(cx, window);
        let started = drain(&events);
        assert_eq!(
            started
                .iter()
                .map(|(event, name, _)| (*event, *name))
                .collect::<Vec<_>>(),
            vec![(E::TransitionStart, "width")]
        );
        assert!(
            (started[0].2 - 0.2).abs() < 1e-6,
            "start must report the 200ms delay, got {}",
            started[0].2
        );

        cx.executor().advance_clock(Duration::from_millis(300));
        draw(cx, window);
        assert_eq!(kinds(&events), vec![(E::TransitionEnd, "width")]);
    }

    #[gpui::test]
    fn reduced_motion_cancels_an_open_lifecycle_without_fabricating_completion(
        cx: &mut TestAppContext,
    ) {
        use NativeEventId as E;
        let events = Rc::new(std::cell::RefCell::new(Vec::new()));
        let window = cx.add_window({
            let events = events.clone();
            move |_, _| LifecycleProbe {
                target: 0.0,
                enabled: true,
                delay: Some("200ms".to_string()),
                duration: Some("300ms".to_string()),
                events,
                motion: MotionBridgeState::default(),
            }
        });
        assert!(kinds(&events).is_empty());

        window
            .update(cx, |probe, _, cx| {
                probe.target = 100.0;
                cx.notify();
            })
            .unwrap();
        draw(cx, window);
        assert_eq!(kinds(&events), vec![(E::TransitionRun, "width")]);

        cx.executor().advance_clock(Duration::from_millis(50));
        cx.update(|cx| cx.set_reduce_motion(true));
        draw(cx, window);
        assert_eq!(
            kinds(&events),
            vec![(E::TransitionCancel, "width")],
            "a forced snap cannot report a start or successful end"
        );
        cx.update(|cx| cx.set_reduce_motion(false));
    }

    #[gpui::test]
    fn completed_transition_ends_before_a_stalled_frame_retargets(cx: &mut TestAppContext) {
        use NativeEventId as E;
        let events = Rc::new(std::cell::RefCell::new(Vec::new()));
        let window = cx.add_window({
            let events = events.clone();
            move |_, _| LifecycleProbe {
                target: 0.0,
                enabled: true,
                delay: None,
                duration: Some("200ms".to_string()),
                events,
                motion: MotionBridgeState::default(),
            }
        });
        assert!(kinds(&events).is_empty());

        window
            .update(cx, |probe, _, cx| {
                probe.target = 100.0;
                cx.notify();
            })
            .unwrap();
        draw(cx, window);
        assert_eq!(
            kinds(&events),
            vec![(E::TransitionRun, "width"), (E::TransitionStart, "width")]
        );

        cx.executor().advance_clock(Duration::from_millis(300));
        window
            .update(cx, |probe, _, cx| {
                probe.target = 200.0;
                cx.notify();
            })
            .unwrap();
        draw(cx, window);
        assert_eq!(
            kinds(&events),
            vec![
                (E::TransitionEnd, "width"),
                (E::TransitionRun, "width"),
                (E::TransitionStart, "width"),
            ],
            "the completed lifecycle must end before its replacement starts"
        );
    }

    #[gpui::test]
    fn lifecycle_keeps_its_creation_delay_when_the_declaration_changes(cx: &mut TestAppContext) {
        use NativeEventId as E;
        let events = Rc::new(std::cell::RefCell::new(Vec::new()));
        let window = cx.add_window({
            let events = events.clone();
            move |_, _| LifecycleProbe {
                target: 0.0,
                enabled: true,
                delay: Some("200ms".to_string()),
                duration: Some("300ms".to_string()),
                events,
                motion: MotionBridgeState::default(),
            }
        });
        assert!(kinds(&events).is_empty());

        window
            .update(cx, |probe, _, cx| {
                probe.target = 100.0;
                cx.notify();
            })
            .unwrap();
        draw(cx, window);
        assert_eq!(kinds(&events), vec![(E::TransitionRun, "width")]);

        cx.executor().advance_clock(Duration::from_millis(50));
        window
            .update(cx, |probe, _, cx| {
                probe.delay = Some("0ms".to_string());
                cx.notify();
            })
            .unwrap();
        draw(cx, window);
        assert!(
            kinds(&events).is_empty(),
            "an in-flight lifecycle keeps its creation delay"
        );

        cx.executor().advance_clock(Duration::from_millis(150));
        draw(cx, window);
        assert_eq!(kinds(&events), vec![(E::TransitionStart, "width")]);
    }

    #[gpui::test]
    fn transition_end_reports_start_timing_not_current_declaration(cx: &mut TestAppContext) {
        use NativeEventId as E;
        let events = Rc::new(std::cell::RefCell::new(Vec::new()));
        let window = cx.add_window({
            let events = events.clone();
            move |_, _| LifecycleProbe {
                target: 0.0,
                enabled: true,
                delay: None,
                duration: Some("300ms".to_string()),
                events,
                motion: MotionBridgeState::default(),
            }
        });
        assert!(kinds(&events).is_empty());

        window
            .update(cx, |probe, _, cx| {
                probe.target = 100.0;
                cx.notify();
            })
            .unwrap();
        draw(cx, window);
        assert_eq!(
            kinds(&events),
            vec![(E::TransitionRun, "width"), (E::TransitionStart, "width")]
        );

        // Changing only the duration mid-flight must not change the in-flight
        // transition's reported timing; GPUI completes with its stored policy.
        window
            .update(cx, |probe, _, cx| {
                probe.duration = Some("2s".to_string());
                cx.notify();
            })
            .unwrap();
        draw(cx, window);
        assert!(
            kinds(&events).is_empty(),
            "a timing-only change must not restart the lifecycle"
        );

        cx.executor().advance_clock(Duration::from_millis(400));
        draw(cx, window);
        let completed = drain(&events);
        assert_eq!(
            completed
                .iter()
                .map(|(event, name, _)| (*event, *name))
                .collect::<Vec<_>>(),
            vec![(E::TransitionEnd, "width")]
        );
        assert!(
            (completed[0].2 - 0.3).abs() < 1e-6,
            "end must report the 300ms duration from run, got {}",
            completed[0].2
        );
    }

    struct UnsupportedLifecycleProbe {
        width: PropertyValue,
        events: Rc<std::cell::RefCell<Vec<(NativeEventId, &'static str, f64)>>>,
        sampled: Rc<Cell<SampledWidth>>,
        motion: MotionBridgeState,
    }

    impl Render for UnsupportedLifecycleProbe {
        fn render(
            &mut self,
            window: &mut Window,
            cx: &mut Context<Self>,
        ) -> impl gpui::IntoElement {
            let mut style = transition_style(0.0, true);
            assert!(style.set_property(PropertyId::Width, &self.width));
            let (resolved, lifecycle) = resolve_style(4, &self.motion, Some(&style), window, cx);
            for event in lifecycle {
                self.events
                    .borrow_mut()
                    .push((event.event, event.property_name(), event.elapsed));
            }
            let resolved = resolved.unwrap_or(style);
            self.sampled.set(match resolved.width {
                Some(LengthValue::Pixels(value)) => SampledWidth::Pixels(value),
                Some(LengthValue::Percent(value)) => SampledWidth::Percent(value),
                _ => SampledWidth::Unset,
            });
            div()
        }
    }

    #[gpui::test]
    fn unsupported_endpoint_snaps_without_later_lifecycle(cx: &mut TestAppContext) {
        use NativeEventId as E;
        let events: Rc<std::cell::RefCell<Vec<(NativeEventId, &'static str, f64)>>> =
            Rc::new(std::cell::RefCell::new(Vec::new()));
        let sampled = Rc::new(Cell::new(SampledWidth::Unset));
        let window = cx.add_window({
            let events = events.clone();
            let sampled = sampled.clone();
            move |_, _| UnsupportedLifecycleProbe {
                width: PropertyValue::Number(0.0),
                events,
                sampled,
                motion: MotionBridgeState::default(),
            }
        });
        assert!(drain(&events).is_empty());

        window
            .update(cx, |probe, _, cx| {
                probe.width = PropertyValue::Number(100.0);
                cx.notify();
            })
            .unwrap();
        draw(cx, window);
        assert_eq!(
            kinds(&events),
            vec![(E::TransitionRun, "width"), (E::TransitionStart, "width")]
        );

        // An unsupported endpoint cancels the in-flight transition and snaps.
        window
            .update(cx, |probe, _, cx| {
                probe.width = PropertyValue::String("50%".into());
                cx.notify();
            })
            .unwrap();
        draw(cx, window);
        assert_eq!(sampled.get(), SampledWidth::Percent(50.0));
        assert_eq!(kinds(&events), vec![(E::TransitionCancel, "width")]);

        // Returning to pixels snaps to the target with no lifecycle, and later
        // frames must not synthesize start or end for the snapped value.
        window
            .update(cx, |probe, _, cx| {
                probe.width = PropertyValue::Number(100.0);
                cx.notify();
            })
            .unwrap();
        draw(cx, window);
        assert_eq!(sampled.get(), SampledWidth::Pixels(100.0));
        assert!(
            kinds(&events).is_empty(),
            "unsupported -> pixel must snap without run"
        );
        cx.executor().advance_clock(Duration::from_millis(100));
        draw(cx, window);
        assert_eq!(sampled.get(), SampledWidth::Pixels(100.0));
        assert!(
            kinds(&events).is_empty(),
            "a snapped value must not emit start or end later"
        );
        cx.executor().advance_clock(Duration::from_millis(300));
        draw(cx, window);
        assert!(
            kinds(&events).is_empty(),
            "completion must not fire without a run"
        );
    }
}
