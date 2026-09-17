use gpui::Styled;

use crate::motion::TransitionSpec;
use crate::protocol::PropertyValue;
use crate::protocol_generated::PropertyId;

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub enum DisplayValue {
    #[default]
    Block,
    Flex,
    None,
}

pub type FlexDirectionValue = gpui::FlexDirection;
pub type FlexWrapValue = gpui::FlexWrap;
pub type AlignValue = gpui::AlignItems;
pub type ContentAlignValue = gpui::AlignContent;
pub type PositionValue = gpui::Position;

pub type TextAlignValue = gpui::TextAlign;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum WhiteSpaceValue {
    Normal,
    NoWrap,
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub enum OverflowValue {
    #[default]
    Visible,
    Clip,
    Hidden,
    Auto,
    Scroll,
}

impl OverflowValue {
    pub fn is_scroll_container(self) -> bool {
        matches!(self, Self::Hidden | Self::Auto | Self::Scroll)
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum LengthValue {
    Auto,
    Pixels(f32),
    Percent(f32),
}

// Keep each property's storage, parser, and GPUI mapping in one declaration.
macro_rules! native_style {
    (
        direct { $($direct:ident: $direct_type:ty => $direct_id:ident($direct_parse:path);)* }
        methods { $($field:ident: $type:ty => $id:ident($parse:path), $method:ident($convert:path);)* }
        custom { $($custom:ident: $custom_type:ty => $custom_id:ident($custom_parse:path);)* }
    ) => {
        #[derive(Clone, Debug, Default)]
        pub struct NativeStyle {
            /// `None` until the author declares `display`; the renderer supplies
            /// kind-specific defaults before applying author declarations.
            pub display: Option<DisplayValue>,
            pub overflow: OverflowValue,
            pub transition: TransitionSpec,
            $(pub $direct: Option<$direct_type>,)*
            $(pub $field: Option<$type>,)*
            $(pub $custom: Option<$custom_type>,)*
        }

        impl NativeStyle {
            pub fn supports_property(property: PropertyId) -> bool {
                if TransitionSpec::supports_property(property) {
                    return true;
                }
                matches!(
                    property,
                    PropertyId::Display
                        | PropertyId::Overflow
                        $(| PropertyId::$direct_id)*
                        $(| PropertyId::$id)*
                        $(| PropertyId::$custom_id)*
                )
            }

            /// Applies one supported author-style declaration. Invalid semantic values
            /// clear that declaration instead of poisoning the renderer.
            pub fn set_property(&mut self, property: PropertyId, value: &PropertyValue) -> bool {
                if self.transition.set_property(property, value) {
                    return true;
                }
                match property {
                    PropertyId::Display => self.display = parse_display(value),
                    PropertyId::Overflow => self.overflow = parse_overflow(value).unwrap_or_default(),
                    $(PropertyId::$direct_id => self.$direct = $direct_parse(value),)*
                    $(PropertyId::$id => self.$field = $parse(value),)*
                    $(PropertyId::$custom_id => self.$custom = $custom_parse(value),)*
                    _ => return false,
                }
                true
            }

            fn apply_fields<T: Styled>(&self, mut element: T) -> T {
                $(if let Some(value) = self.$direct {
                    element.style().$direct = Some(value);
                })*
                $(if let Some(value) = &self.$field {
                    element = element.$method($convert(value.to_owned()));
                })*
                element
            }
        }
    };
}

native_style! {
    direct {
        flex_direction: FlexDirectionValue => FlexDirection(parse_flex_direction);
        flex_wrap: FlexWrapValue => FlexWrap(parse_flex_wrap);
        flex_grow: f32 => FlexGrow(parse_nonnegative_number);
        flex_shrink: f32 => FlexShrink(parse_nonnegative_number);
        align_items: AlignValue => AlignItems(parse_align);
        align_self: AlignValue => AlignSelf(parse_align);
        align_content: ContentAlignValue => AlignContent(parse_content_align);
        justify_content: ContentAlignValue => JustifyContent(parse_content_align);
        position: PositionValue => Position(parse_position);
    }
    methods {
        width: LengthValue => Width(parse_nonnegative_length), w(to_gpui_length);
        height: LengthValue => Height(parse_nonnegative_length), h(to_gpui_length);
        min_width: LengthValue => MinWidth(parse_nonnegative_length), min_w(to_gpui_length);
        min_height: LengthValue => MinHeight(parse_nonnegative_length), min_h(to_gpui_length);
        max_width: LengthValue => MaxWidth(parse_nonnegative_length), max_w(to_gpui_length);
        max_height: LengthValue => MaxHeight(parse_nonnegative_length), max_h(to_gpui_length);
        padding: f32 => Padding(parse_nonnegative_number), p(gpui::px);
        padding_inline: f32 => PaddingInline(parse_nonnegative_number), px(gpui::px);
        padding_block: f32 => PaddingBlock(parse_nonnegative_number), py(gpui::px);
        padding_top: f32 => PaddingTop(parse_nonnegative_number), pt(gpui::px);
        padding_right: f32 => PaddingRight(parse_nonnegative_number), pr(gpui::px);
        padding_bottom: f32 => PaddingBottom(parse_nonnegative_number), pb(gpui::px);
        padding_left: f32 => PaddingLeft(parse_nonnegative_number), pl(gpui::px);
        margin: f32 => Margin(parse_number), m(gpui::px);
        margin_inline: f32 => MarginInline(parse_number), mx(gpui::px);
        margin_block: f32 => MarginBlock(parse_number), my(gpui::px);
        margin_top: f32 => MarginTop(parse_number), mt(gpui::px);
        margin_right: f32 => MarginRight(parse_number), mr(gpui::px);
        margin_bottom: f32 => MarginBottom(parse_number), mb(gpui::px);
        margin_left: f32 => MarginLeft(parse_number), ml(gpui::px);
        top: LengthValue => Top(parse_length), top(to_gpui_length);
        right: LengthValue => Right(parse_length), right(to_gpui_length);
        bottom: LengthValue => Bottom(parse_length), bottom(to_gpui_length);
        left: LengthValue => Left(parse_length), left(to_gpui_length);
        background_color: u32 => BackgroundColor(parse_color), bg(gpui::rgba);
        color: u32 => Color(parse_color), text_color(gpui::rgba);
        opacity: f32 => Opacity(parse_opacity), opacity(std::convert::identity);
        border_width: f32 => BorderWidth(parse_nonnegative_number), border(gpui::px);
        border_color: u32 => BorderColor(parse_color), border_color(gpui::rgba);
        border_radius: f32 => BorderRadius(parse_nonnegative_number), rounded(gpui::px);
        font_size: f32 => FontSize(parse_nonnegative_number), text_size(gpui::px);
        font_family: String => FontFamily(parse_string), font_family(std::convert::identity);
        font_weight: f32 => FontWeight(parse_font_weight), font_weight(gpui::FontWeight);
        text_align: TextAlignValue => TextAlign(parse_text_align), text_align(std::convert::identity);
        line_height: f32 => LineHeight(parse_nonnegative_number), line_height(gpui::px);
    }
    custom {
        scale: [f32; 2] => Scale(crate::transform::parse_scale);
        rotate: f32 => Rotate(crate::transform::parse_rotate);
        translate: crate::transform::Translation => Translate(crate::transform::parse_translate);
        skew: [f32; 2] => Skew(crate::transform::parse_skew);
        transform_origin: crate::transform::TransformOrigin => TransformOrigin(crate::transform::parse_transform_origin);
        gap: f32 => Gap(parse_nonnegative_number);
        row_gap: f32 => RowGap(parse_nonnegative_number);
        column_gap: f32 => ColumnGap(parse_nonnegative_number);
        white_space: WhiteSpaceValue => WhiteSpace(parse_white_space);
    }
}

impl NativeStyle {
    pub fn apply<T: Styled>(&self, mut element: T) -> T {
        if let Some(display) = self.display {
            element = match display {
                DisplayValue::Block => element.block(),
                DisplayValue::Flex => element.flex(),
                DisplayValue::None => element.hidden(),
            };
        }
        element = self.apply_fields(element);
        if let Some(value) = self.row_gap.or(self.gap) {
            element.style().gap.height = Some(gpui::px(value).into());
        }
        if let Some(value) = self.column_gap.or(self.gap) {
            element.style().gap.width = Some(gpui::px(value).into());
        }
        if let Some(white_space) = self.white_space {
            element = match white_space {
                WhiteSpaceValue::Normal => element.whitespace_normal(),
                WhiteSpaceValue::NoWrap => element.whitespace_nowrap(),
            };
        }
        let overflow = match self.overflow {
            OverflowValue::Visible => None,
            OverflowValue::Clip | OverflowValue::Hidden => Some(gpui::Overflow::Hidden),
            OverflowValue::Auto | OverflowValue::Scroll => Some(gpui::Overflow::Scroll),
        };
        element.style().overflow.x = overflow;
        element.style().overflow.y = overflow;
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

fn parse_string(value: &PropertyValue) -> Option<String> {
    match value {
        PropertyValue::String(value) if !value.is_empty() => Some(value.clone()),
        _ => None,
    }
}

pub(crate) fn parse_number(value: &PropertyValue) -> Option<f32> {
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

macro_rules! string_enum_parser {
    ($name:ident, $type:ty, $($value:literal => $variant:path),+ $(,)?) => {
        fn $name(value: &PropertyValue) -> Option<$type> {
            let PropertyValue::String(value) = value else {
                return None;
            };
            match value.as_str() {
                $($value => Some($variant),)+
                _ => None,
            }
        }
    };
}

string_enum_parser!(
    parse_display,
    DisplayValue,
    "block" => DisplayValue::Block,
    "flex" => DisplayValue::Flex,
    "none" => DisplayValue::None,
);
string_enum_parser!(
    parse_flex_direction,
    FlexDirectionValue,
    "row" => FlexDirectionValue::Row,
    "column" => FlexDirectionValue::Column,
    "row-reverse" => FlexDirectionValue::RowReverse,
    "column-reverse" => FlexDirectionValue::ColumnReverse,
);
string_enum_parser!(
    parse_flex_wrap,
    FlexWrapValue,
    "nowrap" => FlexWrapValue::NoWrap,
    "wrap" => FlexWrapValue::Wrap,
    "wrap-reverse" => FlexWrapValue::WrapReverse,
);
string_enum_parser!(
    parse_align,
    AlignValue,
    "start" => AlignValue::Start,
    "end" => AlignValue::End,
    "flex-start" => AlignValue::FlexStart,
    "flex-end" => AlignValue::FlexEnd,
    "center" => AlignValue::Center,
    "baseline" => AlignValue::Baseline,
    "stretch" => AlignValue::Stretch,
);
string_enum_parser!(
    parse_content_align,
    ContentAlignValue,
    "start" => ContentAlignValue::Start,
    "end" => ContentAlignValue::End,
    "flex-start" => ContentAlignValue::FlexStart,
    "flex-end" => ContentAlignValue::FlexEnd,
    "center" => ContentAlignValue::Center,
    "stretch" => ContentAlignValue::Stretch,
    "space-between" => ContentAlignValue::SpaceBetween,
    "space-around" => ContentAlignValue::SpaceAround,
    "space-evenly" => ContentAlignValue::SpaceEvenly,
);
string_enum_parser!(
    parse_position,
    PositionValue,
    "relative" => PositionValue::Relative,
    "absolute" => PositionValue::Absolute,
);
string_enum_parser!(
    parse_text_align,
    TextAlignValue,
    "left" => TextAlignValue::Left,
    "center" => TextAlignValue::Center,
    "right" => TextAlignValue::Right,
);
string_enum_parser!(
    parse_white_space,
    WhiteSpaceValue,
    "normal" => WhiteSpaceValue::Normal,
    "nowrap" => WhiteSpaceValue::NoWrap,
);
string_enum_parser!(
    parse_overflow,
    OverflowValue,
    "visible" => OverflowValue::Visible,
    "clip" => OverflowValue::Clip,
    "hidden" => OverflowValue::Hidden,
    "auto" => OverflowValue::Auto,
    "scroll" => OverflowValue::Scroll,
);

fn parse_length(value: &PropertyValue) -> Option<LengthValue> {
    match value {
        PropertyValue::Number(_) => parse_number(value).map(LengthValue::Pixels),
        PropertyValue::String(value) => {
            let value = value.trim();
            if value == "auto" {
                return Some(LengthValue::Auto);
            }
            let (value, unit): (&str, fn(f32) -> LengthValue) =
                if let Some(value) = value.strip_suffix('%') {
                    (value, LengthValue::Percent)
                } else {
                    (value.strip_suffix("px")?, LengthValue::Pixels)
                };
            value
                .trim()
                .parse::<f32>()
                .ok()
                .filter(|value| value.is_finite())
                .map(unit)
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
    let value = value.trim();
    if let Some(hex) = value.strip_prefix('#') {
        return parse_hex_color(hex);
    }
    // CSS color keywords are ASCII case-insensitive. `currentcolor` and
    // system colors resolve against element context, so they stay unsupported.
    let keyword = value.to_ascii_lowercase();
    if keyword == "transparent" {
        return Some(0x00000000);
    }
    parse_named_color(&keyword)
}

fn parse_hex_color(hex: &str) -> Option<u32> {
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

fn parse_named_color(value: &str) -> Option<u32> {
    Some(match value {
        "aliceblue" => 0xf0f8ffff,
        "antiquewhite" => 0xfaebd7ff,
        "aqua" => 0x00ffffff,
        "aquamarine" => 0x7fffd4ff,
        "azure" => 0xf0ffffff,
        "beige" => 0xf5f5dcff,
        "bisque" => 0xffe4c4ff,
        "black" => 0x000000ff,
        "blanchedalmond" => 0xffebcdff,
        "blue" => 0x0000ffff,
        "blueviolet" => 0x8a2be2ff,
        "brown" => 0xa52a2aff,
        "burlywood" => 0xdeb887ff,
        "cadetblue" => 0x5f9ea0ff,
        "chartreuse" => 0x7fff00ff,
        "chocolate" => 0xd2691eff,
        "coral" => 0xff7f50ff,
        "cornflowerblue" => 0x6495edff,
        "cornsilk" => 0xfff8dcff,
        "crimson" => 0xdc143cff,
        "cyan" => 0x00ffffff,
        "darkblue" => 0x00008bff,
        "darkcyan" => 0x008b8bff,
        "darkgoldenrod" => 0xb8860bff,
        "darkgray" => 0xa9a9a9ff,
        "darkgreen" => 0x006400ff,
        "darkgrey" => 0xa9a9a9ff,
        "darkkhaki" => 0xbdb76bff,
        "darkmagenta" => 0x8b008bff,
        "darkolivegreen" => 0x556b2fff,
        "darkorange" => 0xff8c00ff,
        "darkorchid" => 0x9932ccff,
        "darkred" => 0x8b0000ff,
        "darksalmon" => 0xe9967aff,
        "darkseagreen" => 0x8fbc8fff,
        "darkslateblue" => 0x483d8bff,
        "darkslategray" => 0x2f4f4fff,
        "darkslategrey" => 0x2f4f4fff,
        "darkturquoise" => 0x00ced1ff,
        "darkviolet" => 0x9400d3ff,
        "deeppink" => 0xff1493ff,
        "deepskyblue" => 0x00bfffff,
        "dimgray" => 0x696969ff,
        "dimgrey" => 0x696969ff,
        "dodgerblue" => 0x1e90ffff,
        "firebrick" => 0xb22222ff,
        "floralwhite" => 0xfffaf0ff,
        "forestgreen" => 0x228b22ff,
        "fuchsia" => 0xff00ffff,
        "gainsboro" => 0xdcdcdcff,
        "ghostwhite" => 0xf8f8ffff,
        "gold" => 0xffd700ff,
        "goldenrod" => 0xdaa520ff,
        "gray" => 0x808080ff,
        "green" => 0x008000ff,
        "greenyellow" => 0xadff2fff,
        "grey" => 0x808080ff,
        "honeydew" => 0xf0fff0ff,
        "hotpink" => 0xff69b4ff,
        "indianred" => 0xcd5c5cff,
        "indigo" => 0x4b0082ff,
        "ivory" => 0xfffff0ff,
        "khaki" => 0xf0e68cff,
        "lavender" => 0xe6e6faff,
        "lavenderblush" => 0xfff0f5ff,
        "lawngreen" => 0x7cfc00ff,
        "lemonchiffon" => 0xfffacdff,
        "lightblue" => 0xadd8e6ff,
        "lightcoral" => 0xf08080ff,
        "lightcyan" => 0xe0ffffff,
        "lightgoldenrodyellow" => 0xfafad2ff,
        "lightgray" => 0xd3d3d3ff,
        "lightgreen" => 0x90ee90ff,
        "lightgrey" => 0xd3d3d3ff,
        "lightpink" => 0xffb6c1ff,
        "lightsalmon" => 0xffa07aff,
        "lightseagreen" => 0x20b2aaff,
        "lightskyblue" => 0x87cefaff,
        "lightslategray" => 0x778899ff,
        "lightslategrey" => 0x778899ff,
        "lightsteelblue" => 0xb0c4deff,
        "lightyellow" => 0xffffe0ff,
        "lime" => 0x00ff00ff,
        "limegreen" => 0x32cd32ff,
        "linen" => 0xfaf0e6ff,
        "magenta" => 0xff00ffff,
        "maroon" => 0x800000ff,
        "mediumaquamarine" => 0x66cdaaff,
        "mediumblue" => 0x0000cdff,
        "mediumorchid" => 0xba55d3ff,
        "mediumpurple" => 0x9370dbff,
        "mediumseagreen" => 0x3cb371ff,
        "mediumslateblue" => 0x7b68eeff,
        "mediumspringgreen" => 0x00fa9aff,
        "mediumturquoise" => 0x48d1ccff,
        "mediumvioletred" => 0xc71585ff,
        "midnightblue" => 0x191970ff,
        "mintcream" => 0xf5fffaff,
        "mistyrose" => 0xffe4e1ff,
        "moccasin" => 0xffe4b5ff,
        "navajowhite" => 0xffdeadff,
        "navy" => 0x000080ff,
        "oldlace" => 0xfdf5e6ff,
        "olive" => 0x808000ff,
        "olivedrab" => 0x6b8e23ff,
        "orange" => 0xffa500ff,
        "orangered" => 0xff4500ff,
        "orchid" => 0xda70d6ff,
        "palegoldenrod" => 0xeee8aaff,
        "palegreen" => 0x98fb98ff,
        "paleturquoise" => 0xafeeeeff,
        "palevioletred" => 0xdb7093ff,
        "papayawhip" => 0xffefd5ff,
        "peachpuff" => 0xffdab9ff,
        "peru" => 0xcd853fff,
        "pink" => 0xffc0cbff,
        "plum" => 0xdda0ddff,
        "powderblue" => 0xb0e0e6ff,
        "purple" => 0x800080ff,
        "rebeccapurple" => 0x663399ff,
        "red" => 0xff0000ff,
        "rosybrown" => 0xbc8f8fff,
        "royalblue" => 0x4169e1ff,
        "saddlebrown" => 0x8b4513ff,
        "salmon" => 0xfa8072ff,
        "sandybrown" => 0xf4a460ff,
        "seagreen" => 0x2e8b57ff,
        "seashell" => 0xfff5eeff,
        "sienna" => 0xa0522dff,
        "silver" => 0xc0c0c0ff,
        "skyblue" => 0x87ceebff,
        "slateblue" => 0x6a5acdff,
        "slategray" => 0x708090ff,
        "slategrey" => 0x708090ff,
        "snow" => 0xfffafaff,
        "springgreen" => 0x00ff7fff,
        "steelblue" => 0x4682b4ff,
        "tan" => 0xd2b48cff,
        "teal" => 0x008080ff,
        "thistle" => 0xd8bfd8ff,
        "tomato" => 0xff6347ff,
        "turquoise" => 0x40e0d0ff,
        "violet" => 0xee82eeff,
        "wheat" => 0xf5deb3ff,
        "white" => 0xffffffff,
        "whitesmoke" => 0xf5f5f5ff,
        "yellow" => 0xffff00ff,
        "yellowgreen" => 0x9acd32ff,
        _ => return None,
    })
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
            parse_overflow(&PropertyValue::String("hidden".into())),
            Some(OverflowValue::Hidden)
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
    fn logical_spacing_shorthands_store_axis_values() {
        let mut style = NativeStyle::default();
        assert!(NativeStyle::supports_property(PropertyId::PaddingInline));
        assert!(NativeStyle::supports_property(PropertyId::PaddingBlock));
        assert!(NativeStyle::supports_property(PropertyId::MarginInline));
        assert!(NativeStyle::supports_property(PropertyId::MarginBlock));

        assert!(style.set_property(PropertyId::PaddingInline, &PropertyValue::Number(12.0)));
        assert!(style.set_property(PropertyId::PaddingBlock, &PropertyValue::Number(8.0)));
        assert!(style.set_property(PropertyId::MarginInline, &PropertyValue::Number(-4.0)));
        assert!(style.set_property(PropertyId::MarginBlock, &PropertyValue::Number(6.0)));
        assert_eq!(style.padding_inline, Some(12.0));
        assert_eq!(style.padding_block, Some(8.0));
        assert_eq!(style.margin_inline, Some(-4.0));
        assert_eq!(style.margin_block, Some(6.0));
    }

    #[test]
    fn logical_padding_rejects_negative_values_fail_soft() {
        let mut style = NativeStyle::default();
        style.set_property(PropertyId::PaddingInline, &PropertyValue::Number(12.0));
        style.set_property(PropertyId::PaddingInline, &PropertyValue::Number(-1.0));
        assert_eq!(style.padding_inline, None);

        style.set_property(PropertyId::PaddingBlock, &PropertyValue::Number(8.0));
        style.set_property(
            PropertyId::PaddingBlock,
            &PropertyValue::String("invalid".into()),
        );
        assert_eq!(style.padding_block, None);
    }

    #[test]
    fn logical_spacing_axes_apply_between_all_and_physical_sides() {
        use gpui::Styled;

        let mut style = NativeStyle::default();
        style.set_property(PropertyId::Padding, &PropertyValue::Number(4.0));
        style.set_property(PropertyId::PaddingInline, &PropertyValue::Number(12.0));
        style.set_property(PropertyId::PaddingBlock, &PropertyValue::Number(8.0));
        style.set_property(PropertyId::PaddingLeft, &PropertyValue::Number(20.0));
        style.set_property(PropertyId::Margin, &PropertyValue::Number(2.0));
        style.set_property(PropertyId::MarginInline, &PropertyValue::Number(10.0));
        style.set_property(PropertyId::MarginBlock, &PropertyValue::Number(6.0));
        style.set_property(PropertyId::MarginTop, &PropertyValue::Number(14.0));

        let mut element = style.apply(gpui::div());
        let mut expected = gpui::div()
            .p(gpui::px(4.0))
            .px(gpui::px(12.0))
            .py(gpui::px(8.0))
            .pl(gpui::px(20.0))
            .m(gpui::px(2.0))
            .mx(gpui::px(10.0))
            .my(gpui::px(6.0))
            .mt(gpui::px(14.0));
        assert_eq!(element.style(), expected.style());
    }

    #[test]
    fn named_color_keywords_resolve_to_opaque_srgb() {
        assert_eq!(
            parse_color(&PropertyValue::String("rebeccapurple".into())),
            Some(0x663399ff)
        );
        assert_eq!(
            parse_color(&PropertyValue::String("RebeccaPurple".into())),
            Some(0x663399ff)
        );
        assert_eq!(
            parse_color(&PropertyValue::String("transparent".into())),
            Some(0x00000000)
        );
        assert_eq!(
            parse_color(&PropertyValue::String("currentcolor".into())),
            None
        );
    }

    #[test]
    fn display_is_declaration_tracked_and_flex_is_opt_in() {
        let mut style = NativeStyle::default();
        assert_eq!(style.display, None);

        style.set_property(PropertyId::Display, &PropertyValue::String("flex".into()));
        assert_eq!(style.display, Some(DisplayValue::Flex));

        style.set_property(PropertyId::Display, &PropertyValue::Null);
        assert_eq!(style.display, None);
    }
}
