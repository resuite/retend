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
pub enum LengthValue {
    Auto,
    Pixels(f32),
    Percent(f32),
}

#[derive(Clone, Debug, Default)]
pub struct NativeStyle {
    pub display: DisplayValue,
    pub flex_direction: Option<FlexDirectionValue>,
    pub flex_grow: Option<f32>,
    pub flex_shrink: Option<f32>,
    pub width: Option<LengthValue>,
    pub height: Option<LengthValue>,
    pub min_width: Option<LengthValue>,
    pub min_height: Option<LengthValue>,
    pub max_width: Option<LengthValue>,
    pub max_height: Option<LengthValue>,
    pub background_color: Option<u32>,
    pub color: Option<u32>,
    pub opacity: Option<f32>,
    pub font_size: Option<f32>,
    pub font_family: Option<String>,
    pub font_weight: Option<f32>,
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
            PropertyId::FlexDirection => {
                set(&mut self.flex_direction, value, parse_flex_direction)
            }
            PropertyId::FlexGrow => set(&mut self.flex_grow, value, parse_nonnegative_number),
            PropertyId::FlexShrink => set(&mut self.flex_shrink, value, parse_nonnegative_number),
            PropertyId::Width => set(&mut self.width, value, parse_nonnegative_length),
            PropertyId::Height => set(&mut self.height, value, parse_nonnegative_length),
            PropertyId::MinWidth => set(&mut self.min_width, value, parse_nonnegative_length),
            PropertyId::MinHeight => set(&mut self.min_height, value, parse_nonnegative_length),
            PropertyId::MaxWidth => set(&mut self.max_width, value, parse_nonnegative_length),
            PropertyId::MaxHeight => set(&mut self.max_height, value, parse_nonnegative_length),
            PropertyId::BackgroundColor => {
                set(&mut self.background_color, value, parse_color)
            }
            PropertyId::Color => set(&mut self.color, value, parse_color),
            PropertyId::Opacity => set(&mut self.opacity, value, parse_opacity),
            PropertyId::FontSize => set(&mut self.font_size, value, parse_nonnegative_number),
            PropertyId::FontFamily => set(&mut self.font_family, value, parse_string),
            PropertyId::FontWeight => set(&mut self.font_weight, value, parse_font_weight),
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
        if let Some(grow) = self.flex_grow {
            element = element.flex_grow(grow);
        }
        if let Some(shrink) = self.flex_shrink {
            element = element.flex_shrink(shrink);
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
        if let Some(color) = self.background_color {
            element = element.bg(gpui::rgba(color));
        }
        if let Some(color) = self.color {
            element = element.text_color(gpui::rgba(color));
        }
        if let Some(opacity) = self.opacity {
            element = element.opacity(opacity);
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
            _ => value
                .parse::<f32>()
                .ok()
                .filter(|value| value.is_finite() && *value >= 0.0),
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
    fn parses_supported_lengths_and_colors() {
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
        assert_eq!(
            parse_nonnegative_length(&PropertyValue::Number(-1.0)),
            None
        );
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
