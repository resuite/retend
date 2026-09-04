use gpui::Styled;

use crate::protocol::PropertyValue;
use crate::protocol_generated::PropertyId;

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub enum DisplayValue {
    #[default]
    Block,
    Flex,
    None,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum FlexDirectionValue {
    Row,
    Column,
    RowReverse,
    ColumnReverse,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum FlexWrapValue {
    NoWrap,
    Wrap,
    WrapReverse,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum AlignValue {
    Start,
    End,
    FlexStart,
    FlexEnd,
    Center,
    Baseline,
    Stretch,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum ContentAlignValue {
    Start,
    End,
    FlexStart,
    FlexEnd,
    Center,
    Stretch,
    SpaceBetween,
    SpaceAround,
    SpaceEvenly,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum PositionValue {
    Relative,
    Absolute,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum TextAlignValue {
    Left,
    Center,
    Right,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum WhiteSpaceValue {
    Normal,
    NoWrap,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum LengthValue {
    Auto,
    Pixels(f32),
    Percent(f32),
}

#[derive(Clone, Debug, Default)]
pub struct NativeStyle {
    pub display: DisplayValue,
    pub flex_direction: Option<FlexDirectionValue>,
    pub flex_wrap: Option<FlexWrapValue>,
    pub flex_grow: Option<f32>,
    pub flex_shrink: Option<f32>,
    pub align_items: Option<AlignValue>,
    pub align_self: Option<AlignValue>,
    pub align_content: Option<ContentAlignValue>,
    pub justify_content: Option<ContentAlignValue>,
    pub gap: Option<f32>,
    pub row_gap: Option<f32>,
    pub column_gap: Option<f32>,
    pub width: Option<LengthValue>,
    pub height: Option<LengthValue>,
    pub min_width: Option<LengthValue>,
    pub min_height: Option<LengthValue>,
    pub max_width: Option<LengthValue>,
    pub max_height: Option<LengthValue>,
    pub padding: Option<f32>,
    pub padding_top: Option<f32>,
    pub padding_right: Option<f32>,
    pub padding_bottom: Option<f32>,
    pub padding_left: Option<f32>,
    pub margin: Option<f32>,
    pub margin_top: Option<f32>,
    pub margin_right: Option<f32>,
    pub margin_bottom: Option<f32>,
    pub margin_left: Option<f32>,
    pub position: Option<PositionValue>,
    pub top: Option<LengthValue>,
    pub right: Option<LengthValue>,
    pub bottom: Option<LengthValue>,
    pub left: Option<LengthValue>,
    pub background_color: Option<u32>,
    pub color: Option<u32>,
    pub opacity: Option<f32>,
    pub border_width: Option<f32>,
    pub border_color: Option<u32>,
    pub border_radius: Option<f32>,
    pub font_size: Option<f32>,
    pub font_family: Option<String>,
    pub font_weight: Option<f32>,
    pub text_align: Option<TextAlignValue>,
    pub line_height: Option<f32>,
    pub white_space: Option<WhiteSpaceValue>,
}

impl NativeStyle {
    /// Applies one supported author-style declaration. Invalid semantic values
    /// clear that declaration instead of poisoning the renderer.
    pub fn set_property(&mut self, property: PropertyId, value: &PropertyValue) -> bool {
        match property {
            PropertyId::Display => {
                self.display = if matches!(value, PropertyValue::Null) {
                    DisplayValue::Block
                } else {
                    parse_display(value).unwrap_or(DisplayValue::Block)
                };
            }
            PropertyId::FlexDirection => set(&mut self.flex_direction, value, parse_flex_direction),
            PropertyId::FlexWrap => set(&mut self.flex_wrap, value, parse_flex_wrap),
            PropertyId::FlexGrow => set(&mut self.flex_grow, value, parse_nonnegative_number),
            PropertyId::FlexShrink => set(&mut self.flex_shrink, value, parse_nonnegative_number),
            PropertyId::AlignItems => set(&mut self.align_items, value, parse_align),
            PropertyId::AlignSelf => set(&mut self.align_self, value, parse_align),
            PropertyId::AlignContent => set(&mut self.align_content, value, parse_content_align),
            PropertyId::JustifyContent => {
                set(&mut self.justify_content, value, parse_content_align)
            }
            PropertyId::Gap => set(&mut self.gap, value, parse_nonnegative_number),
            PropertyId::RowGap => set(&mut self.row_gap, value, parse_nonnegative_number),
            PropertyId::ColumnGap => set(&mut self.column_gap, value, parse_nonnegative_number),
            PropertyId::Width => set(&mut self.width, value, parse_nonnegative_length),
            PropertyId::Height => set(&mut self.height, value, parse_nonnegative_length),
            PropertyId::MinWidth => set(&mut self.min_width, value, parse_nonnegative_length),
            PropertyId::MinHeight => set(&mut self.min_height, value, parse_nonnegative_length),
            PropertyId::MaxWidth => set(&mut self.max_width, value, parse_nonnegative_length),
            PropertyId::MaxHeight => set(&mut self.max_height, value, parse_nonnegative_length),
            PropertyId::Padding => set(&mut self.padding, value, parse_nonnegative_number),
            PropertyId::PaddingTop => set(&mut self.padding_top, value, parse_nonnegative_number),
            PropertyId::PaddingRight => {
                set(&mut self.padding_right, value, parse_nonnegative_number)
            }
            PropertyId::PaddingBottom => {
                set(&mut self.padding_bottom, value, parse_nonnegative_number)
            }
            PropertyId::PaddingLeft => set(&mut self.padding_left, value, parse_nonnegative_number),
            PropertyId::Margin => set(&mut self.margin, value, parse_number),
            PropertyId::MarginTop => set(&mut self.margin_top, value, parse_number),
            PropertyId::MarginRight => set(&mut self.margin_right, value, parse_number),
            PropertyId::MarginBottom => set(&mut self.margin_bottom, value, parse_number),
            PropertyId::MarginLeft => set(&mut self.margin_left, value, parse_number),
            PropertyId::Position => set(&mut self.position, value, parse_position),
            PropertyId::Top => set(&mut self.top, value, parse_length),
            PropertyId::Right => set(&mut self.right, value, parse_length),
            PropertyId::Bottom => set(&mut self.bottom, value, parse_length),
            PropertyId::Left => set(&mut self.left, value, parse_length),
            PropertyId::BackgroundColor => set(&mut self.background_color, value, parse_color),
            PropertyId::Color => set(&mut self.color, value, parse_color),
            PropertyId::Opacity => set(&mut self.opacity, value, parse_opacity),
            PropertyId::BorderWidth => set(&mut self.border_width, value, parse_nonnegative_number),
            PropertyId::BorderColor => set(&mut self.border_color, value, parse_color),
            PropertyId::BorderRadius => {
                set(&mut self.border_radius, value, parse_nonnegative_number)
            }
            PropertyId::FontSize => set(&mut self.font_size, value, parse_nonnegative_number),
            PropertyId::FontFamily => set(&mut self.font_family, value, parse_string),
            PropertyId::FontWeight => set(&mut self.font_weight, value, parse_font_weight),
            PropertyId::TextAlign => set(&mut self.text_align, value, parse_text_align),
            PropertyId::LineHeight => set(&mut self.line_height, value, parse_nonnegative_number),
            PropertyId::WhiteSpace => set(&mut self.white_space, value, parse_white_space),
            _ => return false,
        }
        true
    }

    pub fn apply<T: Styled>(&self, mut element: T) -> T {
        element = match self.display {
            DisplayValue::Block => element.block(),
            DisplayValue::Flex => element.flex(),
            DisplayValue::None => element.hidden(),
        };
        if let Some(direction) = self.flex_direction {
            element = match direction {
                FlexDirectionValue::Row => element.flex_row(),
                FlexDirectionValue::Column => element.flex_col(),
                FlexDirectionValue::RowReverse => element.flex_row_reverse(),
                FlexDirectionValue::ColumnReverse => element.flex_col_reverse(),
            };
        }
        if let Some(wrap) = self.flex_wrap {
            element.style().flex_wrap = Some(match wrap {
                FlexWrapValue::NoWrap => gpui::FlexWrap::NoWrap,
                FlexWrapValue::Wrap => gpui::FlexWrap::Wrap,
                FlexWrapValue::WrapReverse => gpui::FlexWrap::WrapReverse,
            });
        }
        if let Some(grow) = self.flex_grow {
            element = element.flex_grow(grow);
        }
        if let Some(shrink) = self.flex_shrink {
            element = element.flex_shrink(shrink);
        }
        if let Some(value) = self.align_items {
            element.style().align_items = Some(to_gpui_align(value));
        }
        if let Some(value) = self.align_self {
            element.style().align_self = Some(to_gpui_align(value));
        }
        if let Some(value) = self.align_content {
            element.style().align_content = Some(to_gpui_content_align(value));
        }
        if let Some(value) = self.justify_content {
            element.style().justify_content = Some(to_gpui_content_align(value));
        }
        if let Some(value) = self.gap {
            element.style().gap.width = Some(gpui::px(value).into());
            element.style().gap.height = Some(gpui::px(value).into());
        }
        if let Some(value) = self.row_gap {
            element.style().gap.height = Some(gpui::px(value).into());
        }
        if let Some(value) = self.column_gap {
            element.style().gap.width = Some(gpui::px(value).into());
        }
        if let Some(width) = self.width {
            element = element.w(to_gpui_length(width));
        }
        if let Some(height) = self.height {
            element = element.h(to_gpui_length(height));
        }
        if let Some(width) = self.min_width {
            element = element.min_w(to_gpui_length(width));
        }
        if let Some(height) = self.min_height {
            element = element.min_h(to_gpui_length(height));
        }
        if let Some(width) = self.max_width {
            element = element.max_w(to_gpui_length(width));
        }
        if let Some(height) = self.max_height {
            element = element.max_h(to_gpui_length(height));
        }
        if let Some(value) = self.padding {
            element = element.p(gpui::px(value));
        }
        if let Some(value) = self.padding_top {
            element = element.pt(gpui::px(value));
        }
        if let Some(value) = self.padding_right {
            element = element.pr(gpui::px(value));
        }
        if let Some(value) = self.padding_bottom {
            element = element.pb(gpui::px(value));
        }
        if let Some(value) = self.padding_left {
            element = element.pl(gpui::px(value));
        }
        if let Some(value) = self.margin {
            element = element.m(gpui::px(value));
        }
        if let Some(value) = self.margin_top {
            element = element.mt(gpui::px(value));
        }
        if let Some(value) = self.margin_right {
            element = element.mr(gpui::px(value));
        }
        if let Some(value) = self.margin_bottom {
            element = element.mb(gpui::px(value));
        }
        if let Some(value) = self.margin_left {
            element = element.ml(gpui::px(value));
        }
        if let Some(position) = self.position {
            element.style().position = Some(match position {
                PositionValue::Relative => gpui::Position::Relative,
                PositionValue::Absolute => gpui::Position::Absolute,
            });
        }
        if let Some(value) = self.top {
            element = element.top(to_gpui_length(value));
        }
        if let Some(value) = self.right {
            element = element.right(to_gpui_length(value));
        }
        if let Some(value) = self.bottom {
            element = element.bottom(to_gpui_length(value));
        }
        if let Some(value) = self.left {
            element = element.left(to_gpui_length(value));
        }
        if let Some(color) = self.background_color {
            element = element.bg(gpui::rgba(color));
        }
        if let Some(color) = self.color {
            element = element.text_color(gpui::rgba(color));
        }
        if let Some(opacity) = self.opacity {
            element = element.opacity(opacity);
        }
        if let Some(width) = self.border_width {
            element = element.border(gpui::px(width));
        }
        if let Some(color) = self.border_color {
            element = element.border_color(gpui::rgba(color));
        }
        if let Some(radius) = self.border_radius {
            element = element.rounded(gpui::px(radius));
        }
        if let Some(font_size) = self.font_size {
            element = element.text_size(gpui::px(font_size));
        }
        if let Some(font_family) = self.font_family.as_ref() {
            element = element.font_family(font_family.clone());
        }
        if let Some(font_weight) = self.font_weight {
            element = element.font_weight(gpui::FontWeight(font_weight));
        }
        if let Some(align) = self.text_align {
            element = match align {
                TextAlignValue::Left => element.text_left(),
                TextAlignValue::Center => element.text_center(),
                TextAlignValue::Right => element.text_right(),
            };
        }
        if let Some(line_height) = self.line_height {
            element = element.line_height(gpui::px(line_height));
        }
        if let Some(white_space) = self.white_space {
            element = match white_space {
                WhiteSpaceValue::Normal => element.whitespace_normal(),
                WhiteSpaceValue::NoWrap => element.whitespace_nowrap(),
            };
        }
        element
    }
}

fn to_gpui_length(value: LengthValue) -> gpui::Length {
    match value {
        LengthValue::Auto => gpui::Length::Auto,
        LengthValue::Pixels(value) => gpui::px(value).into(),
        LengthValue::Percent(value) => gpui::relative(value / 100.0).into(),
    }
}

fn to_gpui_align(value: AlignValue) -> gpui::AlignItems {
    match value {
        AlignValue::Start => gpui::AlignItems::Start,
        AlignValue::End => gpui::AlignItems::End,
        AlignValue::FlexStart => gpui::AlignItems::FlexStart,
        AlignValue::FlexEnd => gpui::AlignItems::FlexEnd,
        AlignValue::Center => gpui::AlignItems::Center,
        AlignValue::Baseline => gpui::AlignItems::Baseline,
        AlignValue::Stretch => gpui::AlignItems::Stretch,
    }
}

fn to_gpui_content_align(value: ContentAlignValue) -> gpui::AlignContent {
    match value {
        ContentAlignValue::Start => gpui::AlignContent::Start,
        ContentAlignValue::End => gpui::AlignContent::End,
        ContentAlignValue::FlexStart => gpui::AlignContent::FlexStart,
        ContentAlignValue::FlexEnd => gpui::AlignContent::FlexEnd,
        ContentAlignValue::Center => gpui::AlignContent::Center,
        ContentAlignValue::Stretch => gpui::AlignContent::Stretch,
        ContentAlignValue::SpaceBetween => gpui::AlignContent::SpaceBetween,
        ContentAlignValue::SpaceAround => gpui::AlignContent::SpaceAround,
        ContentAlignValue::SpaceEvenly => gpui::AlignContent::SpaceEvenly,
    }
}

fn set<T>(target: &mut Option<T>, value: &PropertyValue, parse: fn(&PropertyValue) -> Option<T>) {
    *target = parse(value);
}

fn parse_string(value: &PropertyValue) -> Option<String> {
    match value {
        PropertyValue::String(value) if !value.is_empty() => Some(value.clone()),
        _ => None,
    }
}

fn parse_number(value: &PropertyValue) -> Option<f32> {
    let PropertyValue::Number(value) = value else {
        return None;
    };
    let value = *value as f32;
    value.is_finite().then_some(value)
}

fn parse_nonnegative_number(value: &PropertyValue) -> Option<f32> {
    parse_number(value).filter(|value| *value >= 0.0)
}

fn parse_opacity(value: &PropertyValue) -> Option<f32> {
    parse_number(value).filter(|value| (0.0..=1.0).contains(value))
}

fn parse_font_weight(value: &PropertyValue) -> Option<f32> {
    match value {
        PropertyValue::Number(_) => parse_nonnegative_number(value),
        PropertyValue::String(value) => match value.as_str() {
            "normal" => Some(400.0),
            "bold" => Some(700.0),
            _ => None,
        },
        _ => None,
    }
}

fn parse_display(value: &PropertyValue) -> Option<DisplayValue> {
    match value {
        PropertyValue::String(value) => match value.as_str() {
            "block" => Some(DisplayValue::Block),
            "flex" => Some(DisplayValue::Flex),
            "none" => Some(DisplayValue::None),
            _ => None,
        },
        _ => None,
    }
}

fn parse_flex_direction(value: &PropertyValue) -> Option<FlexDirectionValue> {
    match value {
        PropertyValue::String(value) => match value.as_str() {
            "row" => Some(FlexDirectionValue::Row),
            "column" => Some(FlexDirectionValue::Column),
            "row-reverse" => Some(FlexDirectionValue::RowReverse),
            "column-reverse" => Some(FlexDirectionValue::ColumnReverse),
            _ => None,
        },
        _ => None,
    }
}

fn parse_flex_wrap(value: &PropertyValue) -> Option<FlexWrapValue> {
    match value {
        PropertyValue::String(value) => match value.as_str() {
            "nowrap" => Some(FlexWrapValue::NoWrap),
            "wrap" => Some(FlexWrapValue::Wrap),
            "wrap-reverse" => Some(FlexWrapValue::WrapReverse),
            _ => None,
        },
        _ => None,
    }
}

fn parse_align(value: &PropertyValue) -> Option<AlignValue> {
    match value {
        PropertyValue::String(value) => match value.as_str() {
            "start" => Some(AlignValue::Start),
            "end" => Some(AlignValue::End),
            "flex-start" => Some(AlignValue::FlexStart),
            "flex-end" => Some(AlignValue::FlexEnd),
            "center" => Some(AlignValue::Center),
            "baseline" => Some(AlignValue::Baseline),
            "stretch" => Some(AlignValue::Stretch),
            _ => None,
        },
        _ => None,
    }
}

fn parse_content_align(value: &PropertyValue) -> Option<ContentAlignValue> {
    match value {
        PropertyValue::String(value) => match value.as_str() {
            "start" => Some(ContentAlignValue::Start),
            "end" => Some(ContentAlignValue::End),
            "flex-start" => Some(ContentAlignValue::FlexStart),
            "flex-end" => Some(ContentAlignValue::FlexEnd),
            "center" => Some(ContentAlignValue::Center),
            "stretch" => Some(ContentAlignValue::Stretch),
            "space-between" => Some(ContentAlignValue::SpaceBetween),
            "space-around" => Some(ContentAlignValue::SpaceAround),
            "space-evenly" => Some(ContentAlignValue::SpaceEvenly),
            _ => None,
        },
        _ => None,
    }
}

fn parse_position(value: &PropertyValue) -> Option<PositionValue> {
    match value {
        PropertyValue::String(value) => match value.as_str() {
            "relative" => Some(PositionValue::Relative),
            "absolute" => Some(PositionValue::Absolute),
            _ => None,
        },
        _ => None,
    }
}

fn parse_text_align(value: &PropertyValue) -> Option<TextAlignValue> {
    match value {
        PropertyValue::String(value) => match value.as_str() {
            "left" => Some(TextAlignValue::Left),
            "center" => Some(TextAlignValue::Center),
            "right" => Some(TextAlignValue::Right),
            _ => None,
        },
        _ => None,
    }
}

fn parse_white_space(value: &PropertyValue) -> Option<WhiteSpaceValue> {
    match value {
        PropertyValue::String(value) => match value.as_str() {
            "normal" => Some(WhiteSpaceValue::Normal),
            "nowrap" => Some(WhiteSpaceValue::NoWrap),
            _ => None,
        },
        _ => None,
    }
}

fn parse_length(value: &PropertyValue) -> Option<LengthValue> {
    match value {
        PropertyValue::Number(_) => parse_number(value).map(LengthValue::Pixels),
        PropertyValue::String(value) => {
            let value = value.trim();
            if value == "auto" {
                return Some(LengthValue::Auto);
            }
            if let Some(percent) = value.strip_suffix('%') {
                return percent
                    .trim()
                    .parse::<f32>()
                    .ok()
                    .filter(|value| value.is_finite())
                    .map(LengthValue::Percent);
            }
            if let Some(pixels) = value.strip_suffix("px") {
                return pixels
                    .trim()
                    .parse::<f32>()
                    .ok()
                    .filter(|value| value.is_finite())
                    .map(LengthValue::Pixels);
            }
            None
        }
        _ => None,
    }
}

fn parse_nonnegative_length(value: &PropertyValue) -> Option<LengthValue> {
    parse_length(value).filter(|value| match value {
        LengthValue::Auto => true,
        LengthValue::Pixels(value) | LengthValue::Percent(value) => *value >= 0.0,
    })
}

fn parse_color(value: &PropertyValue) -> Option<u32> {
    let PropertyValue::String(value) = value else {
        return None;
    };
    let hex = value.trim().strip_prefix('#')?;
    let byte = |range| u8::from_str_radix(hex.get(range)?, 16).ok();
    let nibble = |index| {
        let value = u8::from_str_radix(hex.get(index..index + 1)?, 16).ok()?;
        Some((value << 4) | value)
    };
    let (r, g, b, a) = match hex.len() {
        3 => (nibble(0)?, nibble(1)?, nibble(2)?, 0xff),
        4 => (nibble(0)?, nibble(1)?, nibble(2)?, nibble(3)?),
        6 => (byte(0..2)?, byte(2..4)?, byte(4..6)?, 0xff),
        8 => (byte(0..2)?, byte(2..4)?, byte(4..6)?, byte(6..8)?),
        _ => return None,
    };
    Some(u32::from_be_bytes([r, g, b, a]))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_supported_lengths_colors_and_keywords() {
        assert_eq!(
            parse_length(&PropertyValue::String("25%".into())),
            Some(LengthValue::Percent(25.0))
        );
        assert_eq!(
            parse_length(&PropertyValue::String("12px".into())),
            Some(LengthValue::Pixels(12.0))
        );
        assert_eq!(
            parse_color(&PropertyValue::String("#f09c".into())),
            Some(0xff0099cc)
        );
        assert_eq!(
            parse_color(&PropertyValue::String("#336699".into())),
            Some(0x336699ff)
        );
        assert_eq!(parse_nonnegative_length(&PropertyValue::Number(-1.0)), None);
        assert_eq!(
            parse_flex_wrap(&PropertyValue::String("wrap-reverse".into())),
            Some(FlexWrapValue::WrapReverse)
        );
        assert_eq!(
            parse_content_align(&PropertyValue::String("space-between".into())),
            Some(ContentAlignValue::SpaceBetween)
        );
        assert_eq!(
            parse_position(&PropertyValue::String("absolute".into())),
            Some(PositionValue::Absolute)
        );
        assert_eq!(
            parse_font_weight(&PropertyValue::String("500".into())),
            None
        );
        assert_eq!(
            parse_font_weight(&PropertyValue::Number(500.0)),
            Some(500.0)
        );
    }

    #[test]
    fn stores_supported_static_properties_as_parsed_values() {
        let mut style = NativeStyle::default();
        assert!(style.set_property(
            PropertyId::AlignItems,
            &PropertyValue::String("center".into())
        ));
        assert!(style.set_property(PropertyId::Padding, &PropertyValue::Number(12.0)));
        assert!(style.set_property(
            PropertyId::BorderColor,
            &PropertyValue::String("#336699".into())
        ));
        assert!(style.set_property(
            PropertyId::WhiteSpace,
            &PropertyValue::String("nowrap".into())
        ));

        assert_eq!(style.align_items, Some(AlignValue::Center));
        assert_eq!(style.padding, Some(12.0));
        assert_eq!(style.border_color, Some(0x336699ff));
        assert_eq!(style.white_space, Some(WhiteSpaceValue::NoWrap));
    }

    #[test]
    fn invalid_semantic_values_are_fail_soft_and_clear_the_declaration() {
        let mut style = NativeStyle::default();
        style.set_property(PropertyId::Opacity, &PropertyValue::Number(0.5));
        assert_eq!(style.opacity, Some(0.5));

        style.set_property(
            PropertyId::Opacity,
            &PropertyValue::String("not-opacity".into()),
        );
        assert_eq!(style.opacity, None);

        style.set_property(
            PropertyId::FlexWrap,
            &PropertyValue::String("not-wrap".into()),
        );
        assert_eq!(style.flex_wrap, None);
    }

    #[test]
    fn block_is_the_explicit_native_default_and_flex_is_opt_in() {
        let mut style = NativeStyle::default();
        assert_eq!(style.display, DisplayValue::Block);

        style.set_property(PropertyId::Display, &PropertyValue::String("flex".into()));
        assert_eq!(style.display, DisplayValue::Flex);

        style.set_property(PropertyId::Display, &PropertyValue::Null);
        assert_eq!(style.display, DisplayValue::Block);
    }
}
