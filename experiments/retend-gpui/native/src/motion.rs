use std::{cell::Cell, time::Duration};

use gpui::{App, ElementId, Window};
use gpui_base::{transition, Interpolate, Transition};

use crate::{
    protocol::PropertyValue,
    protocol_generated::PropertyId,
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
}

impl AnimatableProperty {
    const ALL: [Self; 8] = [
        Self::Width,
        Self::Height,
        Self::Top,
        Self::Right,
        Self::Bottom,
        Self::Left,
        Self::Opacity,
        Self::BorderRadius,
    ];

    fn bit(self) -> u8 {
        1 << self as u8
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
        }
    }

    fn target(self, style: &NativeStyle) -> TransitionValue {
        let pixels = |value| match value {
            Some(LengthValue::Pixels(value)) => TransitionValue::Value(value),
            _ => TransitionValue::Unset,
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
        }
    }

    fn apply(self, style: &mut NativeStyle, value: TransitionValue) {
        let TransitionValue::Value(value) = value else {
            return;
        };
        match self {
            Self::Width => style.width = Some(LengthValue::Pixels(value)),
            Self::Height => style.height = Some(LengthValue::Pixels(value)),
            Self::Top => style.top = Some(LengthValue::Pixels(value)),
            Self::Right => style.right = Some(LengthValue::Pixels(value)),
            Self::Bottom => style.bottom = Some(LengthValue::Pixels(value)),
            Self::Left => style.left = Some(LengthValue::Pixels(value)),
            Self::Opacity => style.opacity = Some(value),
            Self::BorderRadius => style.border_radius = Some(value),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum TransitionValue {
    Unset,
    Value(f32),
}

impl Interpolate for TransitionValue {
    fn interpolate(&self, target: &Self, progress: f32) -> Self {
        match (*self, *target) {
            (Self::Value(from), Self::Value(to)) => {
                Self::Value(from + (to - from) * progress)
            }
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
    properties: u8,
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

fn parse_transition_properties(value: &PropertyValue) -> u8 {
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

#[derive(Debug)]
pub(crate) struct MotionBridgeState {
    initialized: Cell<bool>,
    previous_targets: Cell<[TransitionValue; 8]>,
    active_mask: Cell<u8>,
}

impl Default for MotionBridgeState {
    fn default() -> Self {
        Self {
            initialized: Cell::new(false),
            previous_targets: Cell::new([TransitionValue::Unset; 8]),
            active_mask: Cell::new(0),
        }
    }
}

fn eligible_mask(transition: TransitionSpec, targets: &[TransitionValue; 8]) -> u8 {
    AnimatableProperty::ALL
        .into_iter()
        .filter(|property| {
            transition.properties & property.bit() != 0
                && targets[*property as usize] != TransitionValue::Unset
        })
        .fold(0, |mask, property| mask | property.bit())
}

fn transition_policy(config: TransitionConfig, target: TransitionValue) -> Transition {
    if target == TransitionValue::Unset {
        return Transition::new(Duration::ZERO);
    }
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
) -> Option<NativeStyle> {
    let Some(target_style) = author else {
        state
            .previous_targets
            .set([TransitionValue::Unset; AnimatableProperty::ALL.len()]);
        state.active_mask.set(0);
        state.initialized.set(true);
        return None;
    };
    let spec = target_style.transition;
    let targets = AnimatableProperty::ALL.map(|property| property.target(target_style));
    let config = spec.config();
    let current_mask = if spec.properties == 0 || config.is_none() {
        0
    } else {
        eligible_mask(spec, &targets)
    };
    let previous_targets = state.previous_targets.replace(targets);
    let previous_mask = state.active_mask.replace(current_mask);
    let initialized = state.initialized.replace(true);

    let config = config.filter(|_| current_mask != 0)?;

    let element_id = ElementId::Integer(u64::from(node_id));
    let mut resolved = None;
    for property in AnimatableProperty::ALL
        .into_iter()
        .filter(|property| current_mask & property.bit() != 0)
    {
        let index = property as usize;
        let target = targets[index];
        let key = (element_id.clone(), property.channel());
        if initialized && previous_mask & property.bit() == 0 {
            transition(
                key.clone(),
                previous_targets[index],
                Transition::new(Duration::ZERO),
                window,
                cx,
            );
        }
        let value = transition(key, target, transition_policy(config, target), window, cx);
        if value != target {
            property.apply(resolved.get_or_insert_with(|| target_style.clone()), value);
        }
    }
    resolved
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
        fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl gpui::IntoElement {
            let style = transition_style(self.target, self.enabled);
            let resolved =
                resolve_style(1, &self.motion, Some(&style), window, cx).unwrap_or(style);
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

    fn draw(cx: &mut TestAppContext, window: gpui::WindowHandle<MotionProbe>) {
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
    fn removing_eligibility_reseeds_and_reduced_motion_snaps_through_gpui(
        cx: &mut TestAppContext,
    ) {
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
    fn representable_targets_cover_the_v1_property_set() {
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
        assert!(AnimatableProperty::ALL
            .into_iter()
            .all(|property| property.target(&style) != TransitionValue::Unset));
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
        fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl gpui::IntoElement {
            let mut style = transition_style(0.0, true);
            assert!(style.set_property(PropertyId::Width, &self.width));
            let resolved =
                resolve_style(2, &self.motion, Some(&style), window, cx).unwrap_or(style);
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
        assert!(matches!(sampled.get(), SampledWidth::Pixels(value) if value > 0.0 && value < 100.0));

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
}
