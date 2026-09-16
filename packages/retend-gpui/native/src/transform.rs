use gpui::{
    point, px, radians, size, AnyElement, App, Bounds, Element, ElementId, GlobalElementId,
    InspectorElementId, IntoElement, LayoutId, Pixels, TransformationMatrix, Window,
};

use crate::{protocol::PropertyValue, style::NativeStyle};

/// Keep pixels and fractions separate so mixed-unit translations interpolate
/// without measuring in JS or freezing percentages to an old layout size.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Translation(pub [f32; 4]);

/// Transform origin relative to the border box, stored as
/// `[x_px, x_fraction, y_px, y_fraction]`. Defaults to `50% 50%` (center).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct TransformOrigin(pub [f32; 4]);

impl Default for TransformOrigin {
    fn default() -> Self {
        Self([0.0, 0.5, 0.0, 0.5])
    }
}

fn finite(value: &str) -> Option<f32> {
    value.parse::<f32>().ok().filter(|value| value.is_finite())
}

/// Shared px/percentage/bare-zero length: `[pixels, fraction]`.
fn length_pair(value: &str) -> Option<[f32; 2]> {
    if let Some(value) = value.strip_suffix('%') {
        Some([0.0, finite(value)? / 100.0])
    } else if let Some(value) = value.strip_suffix("px") {
        Some([finite(value)?, 0.0])
    } else {
        Some([finite(value).filter(|value| *value == 0.0)?, 0.0])
    }
}

fn angle(value: &str) -> Option<f32> {
    for (unit, multiplier) in [
        ("deg", std::f32::consts::PI / 180.0),
        ("grad", std::f32::consts::PI / 200.0),
        ("rad", 1.0),
        ("turn", std::f32::consts::TAU),
    ] {
        if let Some(value) = value.strip_suffix(unit) {
            return finite(value)
                .map(|value| value * multiplier)
                .filter(|v| v.is_finite());
        }
    }
    finite(value).filter(|value| *value == 0.0)
}

fn components(value: &PropertyValue) -> Option<(&str, Option<&str>)> {
    let PropertyValue::String(value) = value else {
        return None;
    };
    let mut parts = value.split_whitespace();
    let first = parts.next()?;
    let second = parts.next();
    parts.next().is_none().then_some((first, second))
}

fn number(value: &PropertyValue) -> Option<f32> {
    match value {
        PropertyValue::Number(value) => {
            let value = *value as f32;
            value.is_finite().then_some(value)
        }
        _ => None,
    }
}

fn is_none(value: &PropertyValue) -> bool {
    matches!(value, PropertyValue::String(value) if value.trim() == "none")
}

pub fn parse_scale(value: &PropertyValue) -> Option<[f32; 2]> {
    if is_none(value) {
        return Some([1.0; 2]);
    }
    if let Some(value) = number(value) {
        return Some([value; 2]);
    }
    let scale = |value: &str| match value.strip_suffix('%') {
        Some(value) => finite(value).map(|value| value / 100.0),
        None => finite(value),
    };
    let (x, y) = components(value)?;
    let x = scale(x)?;
    Some([x, y.map(scale).unwrap_or(Some(x))?])
}

pub fn parse_rotate(value: &PropertyValue) -> Option<f32> {
    if is_none(value) {
        return Some(0.0);
    }
    if let Some(value) = number(value) {
        return Some(value.to_radians()).filter(|v| v.is_finite());
    }
    let PropertyValue::String(value) = value else {
        return None;
    };
    angle(value.trim())
}

pub fn parse_skew(value: &PropertyValue) -> Option<[f32; 2]> {
    if is_none(value) {
        return Some([0.0; 2]);
    }
    if let Some(value) = number(value) {
        return Some([value.to_radians(), 0.0]);
    }
    let (x, y) = components(value)?;
    Some([angle(x)?, y.map(angle).unwrap_or(Some(0.0))?])
}

pub fn parse_translate(value: &PropertyValue) -> Option<Translation> {
    if is_none(value) {
        return Some(Translation::default());
    }
    if let Some(value) = number(value) {
        return Some(Translation([value, 0.0, 0.0, 0.0]));
    }
    let (x, y) = components(value)?;
    let [x, x_percent] = length_pair(x)?;
    let [y, y_percent] = y.map(length_pair).unwrap_or(Some([0.0; 2]))?;
    Some(Translation([x, x_percent, y, y_percent]))
}

fn origin_x_keyword(value: &str) -> Option<f32> {
    match value {
        "left" => Some(0.0),
        "center" => Some(0.5),
        "right" => Some(1.0),
        _ => None,
    }
}

fn origin_y_keyword(value: &str) -> Option<f32> {
    match value {
        "top" => Some(0.0),
        "center" => Some(0.5),
        "bottom" => Some(1.0),
        _ => None,
    }
}

fn origin_component(value: &str, keyword: fn(&str) -> Option<f32>) -> Option<[f32; 2]> {
    if let Some(fraction) = keyword(value) {
        return Some([0.0, fraction]);
    }
    length_pair(value)
}

pub fn parse_transform_origin(value: &PropertyValue) -> Option<TransformOrigin> {
    if let Some(value) = number(value) {
        return Some(TransformOrigin([value, 0.0, 0.0, 0.5]));
    }
    let (first, second) = components(value)?;
    let Some(second) = second else {
        // Single value: keywords resolve against their axis with the other
        // axis defaulting to center; lengths resolve against x.
        if let Some(fraction) = origin_x_keyword(first) {
            return Some(TransformOrigin([0.0, fraction, 0.0, 0.5]));
        }
        if let Some(fraction) = origin_y_keyword(first) {
            return Some(TransformOrigin([0.0, 0.5, 0.0, fraction]));
        }
        let [x, x_fraction] = length_pair(first)?;
        return Some(TransformOrigin([x, x_fraction, 0.0, 0.5]));
    };
    // Two values in x/y order, plus a keyword-led y/x swap such as
    // `top left` (matching CSS position behavior). Length-first pairs never
    // swap, so `10px left` is rejected instead of silently reinterpreted.
    if let (Some([x, x_fraction]), Some([y, y_fraction])) = (
        origin_component(first, origin_x_keyword),
        origin_component(second, origin_y_keyword),
    ) {
        return Some(TransformOrigin([x, x_fraction, y, y_fraction]));
    }
    let fraction = origin_y_keyword(first)?;
    let [x, x_fraction] = origin_component(second, origin_x_keyword)?;
    Some(TransformOrigin([x, x_fraction, 0.0, fraction]))
}

#[derive(Clone, Copy, Debug)]
struct Transform {
    translate: Translation,
    rotate: f32,
    scale: [f32; 2],
    skew: [f32; 2],
    origin: TransformOrigin,
}

impl Transform {
    fn matrix(self, bounds: Bounds<Pixels>) -> TransformationMatrix {
        let [x, x_percent, y, y_percent] = self.translate.0;
        let translation = point(
            px(x + x_percent * f32::from(bounds.size.width)),
            px(y + y_percent * f32::from(bounds.size.height)),
        );
        let [ox_px, ox_fraction, oy_px, oy_fraction] = self.origin.0;
        let origin = point(
            bounds.origin.x + px(ox_px + ox_fraction * f32::from(bounds.size.width)),
            bounds.origin.y + px(oy_px + oy_fraction * f32::from(bounds.size.height)),
        );
        // CSS individual properties compose as T * R * S. The Retend-only skew
        // follows scale, equivalent to a trailing skew() in CSS transform.
        // `scale(1.0)` converts `Point<Pixels>` to `Point<ScaledPixels>`.
        TransformationMatrix::unit()
            .translate((origin + translation).scale(1.0))
            .rotate(radians(self.rotate))
            .scale(size(self.scale[0], self.scale[1]))
            .compose(TransformationMatrix {
                rotation_scale: [[1.0, self.skew[0].tan()], [self.skew[1].tan(), 1.0]],
                translation: [0.0; 2],
            })
            .translate(origin.scale(-1.0))
    }
}

pub fn wrap(inner: AnyElement, style: Option<&NativeStyle>) -> AnyElement {
    let Some(style) = style else { return inner };
    let transform = Transform {
        translate: style.translate.unwrap_or_default(),
        rotate: style.rotate.unwrap_or_default(),
        scale: style.scale.unwrap_or([1.0; 2]),
        skew: style.skew.unwrap_or_default(),
        origin: style.transform_origin.unwrap_or_default(),
    };
    if transform.translate == Translation::default()
        && transform.rotate == 0.0
        && transform.scale == [1.0; 2]
        && transform.skew == [0.0; 2]
        && transform.origin == TransformOrigin::default()
    {
        return inner;
    }
    Transformed { inner, transform }.into_any_element()
}

struct Transformed {
    inner: AnyElement,
    transform: Transform,
}

impl IntoElement for Transformed {
    type Element = Self;
    fn into_element(self) -> Self {
        self
    }
}

impl Element for Transformed {
    type RequestLayoutState = ();
    type PrepaintState = TransformationMatrix;

    fn id(&self) -> Option<ElementId> {
        None
    }
    fn source_location(&self) -> Option<&'static std::panic::Location<'static>> {
        None
    }

    fn request_layout(
        &mut self,
        _: Option<&GlobalElementId>,
        _: Option<&InspectorElementId>,
        window: &mut Window,
        cx: &mut App,
    ) -> (LayoutId, ()) {
        (self.inner.request_layout(window, cx), ())
    }

    fn prepaint(
        &mut self,
        _: Option<&GlobalElementId>,
        _: Option<&InspectorElementId>,
        bounds: Bounds<Pixels>,
        _: &mut (),
        window: &mut Window,
        cx: &mut App,
    ) -> TransformationMatrix {
        let matrix = self.transform.matrix(bounds);
        window.with_element_transform(matrix, |window| self.inner.prepaint(window, cx));
        matrix
    }

    fn paint(
        &mut self,
        _: Option<&GlobalElementId>,
        _: Option<&InspectorElementId>,
        _: Bounds<Pixels>,
        _: &mut (),
        matrix: &mut TransformationMatrix,
        window: &mut Window,
        cx: &mut App,
    ) {
        window.with_element_transform(*matrix, |window| self.inner.paint(window, cx));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn text(value: &str) -> PropertyValue {
        PropertyValue::String(value.into())
    }

    #[test]
    fn parses_individual_2d_values() {
        assert_eq!(parse_scale(&text("150% -2")), Some([1.5, -2.0]));
        assert_eq!(parse_scale(&text("0")), Some([0.0; 2]));
        assert_eq!(
            parse_translate(&text("-12px 50%")),
            Some(Translation([-12.0, 0.0, 0.0, 0.5]))
        );
        assert_eq!(
            parse_translate(&PropertyValue::Number(12.0)),
            Some(Translation([12.0, 0.0, 0.0, 0.0]))
        );
        assert!((parse_rotate(&text("200grad")).unwrap() - std::f32::consts::PI).abs() < 1e-6);
        assert_eq!(
            parse_rotate(&text("0.5turn")),
            parse_rotate(&text("180deg"))
        );
        assert_eq!(
            parse_skew(&text("45deg")),
            Some([std::f32::consts::FRAC_PI_4, 0.0])
        );
        for value in ["1 2 3", "NaN", "infinity", "scale(2)", ""] {
            assert_eq!(parse_scale(&text(value)), None, "{value}");
        }
        for value in ["10", "auto", "10px 20px 30px", "NaNpx", "calc(2px)"] {
            assert_eq!(parse_translate(&text(value)), None, "{value}");
        }
        assert_eq!(parse_rotate(&text("z 30deg")), None);
        assert_eq!(parse_skew(&text("30deg 10deg 2deg")), None);
        assert_eq!(parse_scale(&text("none")), Some([1.0; 2]));
        assert_eq!(parse_translate(&text("none")), Some(Translation::default()));
    }

    #[test]
    fn composes_around_border_box_center_without_changing_layout() {
        let transform = Transform {
            translate: Translation([10.0, 0.5, 0.0, 0.0]),
            rotate: std::f32::consts::FRAC_PI_2,
            scale: [2.0, 1.0],
            skew: [0.0; 2],
            origin: TransformOrigin::default(),
        };
        let bounds = Bounds::new(point(px(20.0), px(30.0)), size(px(100.0), px(40.0)));
        let matrix = transform.matrix(bounds);
        let center = matrix.apply(bounds.center());
        assert!((f32::from(center.x) - 130.0).abs() < 0.001);
        assert!((f32::from(center.y) - 50.0).abs() < 0.001);
        let right = matrix.apply(bounds.center() + point(px(10.0), px(0.0)));
        assert!((f32::from(right.x) - 130.0).abs() < 0.001);
        assert!((f32::from(right.y) - 70.0).abs() < 0.001);
    }

    #[test]
    fn parses_transform_origin_keywords_lengths_and_order() {
        assert_eq!(
            parse_transform_origin(&text("left")),
            Some(TransformOrigin([0.0, 0.0, 0.0, 0.5]))
        );
        assert_eq!(
            parse_transform_origin(&text("center")),
            Some(TransformOrigin([0.0, 0.5, 0.0, 0.5]))
        );
        assert_eq!(
            parse_transform_origin(&text("bottom")),
            Some(TransformOrigin([0.0, 0.5, 0.0, 1.0]))
        );
        assert_eq!(
            parse_transform_origin(&text("10px")),
            Some(TransformOrigin([10.0, 0.0, 0.0, 0.5]))
        );
        assert_eq!(
            parse_transform_origin(&PropertyValue::Number(12.0)),
            Some(TransformOrigin([12.0, 0.0, 0.0, 0.5]))
        );
        assert_eq!(
            parse_transform_origin(&text("left top")),
            Some(TransformOrigin([0.0, 0.0, 0.0, 0.0]))
        );
        assert_eq!(
            parse_transform_origin(&text("top left")),
            Some(TransformOrigin([0.0, 0.0, 0.0, 0.0]))
        );
        assert_eq!(
            parse_transform_origin(&text("25% 75%")),
            Some(TransformOrigin([0.0, 0.25, 0.0, 0.75]))
        );
        assert_eq!(
            parse_transform_origin(&text("10px 20px")),
            Some(TransformOrigin([10.0, 0.0, 20.0, 0.0]))
        );
        for value in ["left right", "top bottom", "10px 20px 30px", "auto", "", "none"] {
            assert_eq!(parse_transform_origin(&text(value)), None, "{value}");
        }
    }

    #[test]
    fn composes_around_a_custom_origin() {
        let bounds = Bounds::new(point(px(20.0), px(30.0)), size(px(100.0), px(40.0)));
        // A 180deg turn about the top-left corner swaps the center to the
        // opposite corner of the border box.
        let transform = Transform {
            translate: Translation::default(),
            rotate: std::f32::consts::PI,
            scale: [1.0; 2],
            skew: [0.0; 2],
            origin: TransformOrigin([0.0, 0.0, 0.0, 0.0]),
        };
        let center = transform.matrix(bounds).apply(bounds.center());
        assert!((f32::from(center.x) - -30.0).abs() < 0.01);
        assert!((f32::from(center.y) - 10.0).abs() < 0.01);
    }
}
