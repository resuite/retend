use std::{fmt::Display, str};

use crate::protocol_generated::{
    ElementKind, NativeEventId, Opcode, PropertyId, StyleState, ValueKind, PROTOCOL_MAGIC,
    PROTOCOL_VERSION,
};
use crate::BridgeFailure;

pub const HEADER_BYTES: usize = 24;

#[derive(Debug, PartialEq)]
pub enum PropertyValue {
    Null,
    Number(f64),
    Boolean(bool),
    String(String),
}

// Field order here is the binary wire order as well as the retained command shape.
macro_rules! commands {
    ($reader:ident, $strings:ident; $($name:ident { $($field:ident: $type:ty = $read:expr),* $(,)? }),* $(,)?) => {
        #[derive(Debug, PartialEq)]
        pub enum Command { $($name { $($field: $type),* }),* }

        fn decode_command($reader: &mut Reader<'_>, $strings: &[&str]) -> Result<Command, BridgeFailure> {
            let opcode = $reader.read_enum(Reader::read_u8, "UNKNOWN_OPCODE", "opcode")?;
            Ok(match opcode {
                $(Opcode::$name => Command::$name { $($field: $read),* }),*
            })
        }
    };
}

commands! { reader, strings;
    CreateNode {
        id: u32 = reader.read_u32()?,
        kind: ElementKind = reader.read_enum(Reader::read_u8, "UNKNOWN_ELEMENT_KIND", "element kind")?,
    },
    CreateText {
        id: u32 = reader.read_u32()?,
        text: String = read_string(reader, strings)?,
    },
    UpdateText {
        id: u32 = reader.read_u32()?,
        text: String = read_string(reader, strings)?,
    },
    SetProperty {
        id: u32 = reader.read_u32()?,
        property: PropertyId = reader.read_enum(Reader::read_u16, "UNKNOWN_PROPERTY", "property ID")?,
        value: PropertyValue = read_property_value(reader, strings)?,
    },
    SetStyle {
        id: u32 = reader.read_u32()?,
        properties: Vec<(PropertyId, PropertyValue)> = read_style(reader, strings)?,
    },
    SetPseudoStyle {
        id: u32 = reader.read_u32()?,
        state: StyleState = reader.read_enum(Reader::read_u8, "UNKNOWN_STYLE_STATE", "style state")?,
        properties: Vec<(PropertyId, PropertyValue)> = read_style(reader, strings)?,
    },
    InsertChild {
        parent_id: u32 = reader.read_u32()?,
        child_id: u32 = reader.read_u32()?,
        before_id: u32 = reader.read_u32()?,
    },
    RemoveChild {
        parent_id: u32 = reader.read_u32()?,
        child_id: u32 = reader.read_u32()?,
    },
    SubscribeEvent {
        id: u32 = reader.read_u32()?,
        event: NativeEventId = reader.read_enum(Reader::read_u16, "UNKNOWN_NATIVE_EVENT", "native event ID")?,
    },
    UnsubscribeEvent {
        id: u32 = reader.read_u32()?,
        event: NativeEventId = reader.read_enum(Reader::read_u16, "UNKNOWN_NATIVE_EVENT", "native event ID")?,
    },
}

struct Reader<'a> {
    bytes: &'a [u8],
    pos: usize,
    end: usize,
}

impl<'a> Reader<'a> {
    fn new(bytes: &'a [u8], start: usize, end: usize) -> Self {
        Self {
            bytes,
            pos: start,
            end,
        }
    }

    fn read_enum<T, N>(
        &mut self,
        read: impl FnOnce(&mut Self) -> Result<N, BridgeFailure>,
        code: &'static str,
        name: &'static str,
    ) -> Result<T, BridgeFailure>
    where
        T: TryFrom<N, Error = ()>,
        N: Copy + Display,
    {
        let offset = self.pos;
        let value = read(self)?;
        T::try_from(value).map_err(|()| {
            BridgeFailure::wire(code, format!("Unknown {name} {value}."), Some(offset))
        })
    }

    fn read<const N: usize>(&mut self) -> Result<[u8; N], BridgeFailure> {
        Ok(self
            .read_bytes(N)?
            .try_into()
            .expect("validated slice length must match fixed read width"))
    }

    fn read_u8(&mut self) -> Result<u8, BridgeFailure> {
        Ok(self.read::<1>()?[0])
    }

    fn read_u16(&mut self) -> Result<u16, BridgeFailure> {
        Ok(u16::from_le_bytes(self.read()?))
    }

    fn read_u32(&mut self) -> Result<u32, BridgeFailure> {
        Ok(u32::from_le_bytes(self.read()?))
    }

    fn read_f64(&mut self) -> Result<f64, BridgeFailure> {
        Ok(f64::from_le_bytes(self.read()?))
    }

    fn read_bytes(&mut self, length: usize) -> Result<&'a [u8], BridgeFailure> {
        self.require(length)?;
        let start = self.pos;
        self.pos += length;
        Ok(&self.bytes[start..self.pos])
    }

    fn require(&self, length: usize) -> Result<(), BridgeFailure> {
        if self.pos.saturating_add(length) <= self.end {
            return Ok(());
        }
        Err(BridgeFailure::wire(
            "TRUNCATED_BUFFER",
            "Command batch ended in the middle of a fixed-schema value.",
            Some(self.pos),
        ))
    }
}

pub fn decode_command_batch(bytes: &[u8]) -> Result<Vec<Command>, BridgeFailure> {
    if bytes.len() < HEADER_BYTES {
        return Err(BridgeFailure::wire(
            "TRUNCATED_HEADER",
            "Command batch is shorter than the 24-byte header.",
            Some(bytes.len()),
        ));
    }

    let mut header = Reader::new(bytes, 0, HEADER_BYTES);
    let magic = header.read_u32()?;
    if magic != PROTOCOL_MAGIC {
        return Err(BridgeFailure::wire(
            "INVALID_MAGIC",
            format!("Invalid command batch magic {magic:#010x}."),
            Some(0),
        ));
    }
    let version = header.read_u16()?;
    if version != PROTOCOL_VERSION {
        return Err(BridgeFailure::wire(
            "UNSUPPORTED_VERSION",
            format!("Unsupported protocol version {version}; expected {PROTOCOL_VERSION}."),
            Some(4),
        ));
    }
    let flags = header.read_u16()?;
    if flags != 0 {
        return Err(BridgeFailure::wire(
            "UNSUPPORTED_FLAGS",
            format!("Unsupported command batch header flags {flags:#06x}."),
            Some(6),
        ));
    }
    let command_bytes = header.read_u32()? as usize;
    let command_count = header.read_u32()? as usize;
    let string_offset = header.read_u32()? as usize;
    let string_count = header.read_u32()? as usize;

    let command_end = HEADER_BYTES + command_bytes;
    if command_end != string_offset || command_end > bytes.len() {
        return Err(BridgeFailure::wire(
            "INVALID_BOUNDS",
            "Header command extent and string-table offset do not describe one contiguous buffer.",
            Some(16),
        ));
    }
    if command_count > command_bytes {
        return Err(BridgeFailure::wire(
            "INVALID_COMMAND_COUNT",
            "Command count exceeds the number of bytes in the command stream.",
            Some(12),
        ));
    }
    if string_count > (bytes.len() - string_offset) / 4 {
        return Err(BridgeFailure::wire(
            "INVALID_STRING_COUNT",
            "String count exceeds the capacity of the string-table region.",
            Some(20),
        ));
    }

    let strings = decode_strings(bytes, string_offset, string_count)?;
    let mut reader = Reader::new(bytes, HEADER_BYTES, command_end);
    let mut commands = reserved_vec(
        command_count,
        12,
        "Command count could not be reserved safely.",
    )?;
    for _ in 0..command_count {
        commands.push(decode_command(&mut reader, &strings)?);
    }
    if reader.pos != command_end {
        return Err(BridgeFailure::wire(
            "COMMAND_COUNT_MISMATCH",
            "Command count did not consume the complete command stream.",
            Some(reader.pos),
        ));
    }
    Ok(commands)
}

fn reserved_vec<T>(
    count: usize,
    offset: usize,
    message: &'static str,
) -> Result<Vec<T>, BridgeFailure> {
    let mut values = Vec::new();
    values
        .try_reserve_exact(count)
        .map_err(|_| BridgeFailure::wire("ALLOCATION_FAILED", message, Some(offset)))?;
    Ok(values)
}

fn decode_strings(bytes: &[u8], offset: usize, count: usize) -> Result<Vec<&str>, BridgeFailure> {
    let mut reader = Reader::new(bytes, offset, bytes.len());
    let mut strings = reserved_vec(count, offset, "String count could not be reserved safely.")?;
    for _ in 0..count {
        let length = reader.read_u32()? as usize;
        let start = reader.pos;
        let raw = reader.read_bytes(length)?;
        let value = str::from_utf8(raw).map_err(|_| {
            BridgeFailure::wire(
                "INVALID_UTF8",
                "String table contains invalid UTF-8.",
                Some(start),
            )
        })?;
        strings.push(value);
    }
    if reader.pos != bytes.len() {
        return Err(BridgeFailure::wire(
            "STRING_COUNT_MISMATCH",
            "String count did not consume the complete string table.",
            Some(reader.pos),
        ));
    }
    Ok(strings)
}

fn read_style(
    reader: &mut Reader<'_>,
    strings: &[&str],
) -> Result<Vec<(PropertyId, PropertyValue)>, BridgeFailure> {
    let count = reader.read_u16()? as usize;
    let mut properties = reserved_vec(
        count,
        reader.pos - 2,
        "Style property count could not be reserved safely.",
    )?;
    for _ in 0..count {
        properties.push((
            reader.read_enum(Reader::read_u16, "UNKNOWN_PROPERTY", "property ID")?,
            read_property_value(reader, strings)?,
        ));
    }
    Ok(properties)
}

fn read_property_value(
    reader: &mut Reader<'_>,
    strings: &[&str],
) -> Result<PropertyValue, BridgeFailure> {
    let kind = reader.read_enum(Reader::read_u8, "UNKNOWN_VALUE_KIND", "property value kind")?;
    match kind {
        ValueKind::Null => Ok(PropertyValue::Null),
        ValueKind::Number => Ok(PropertyValue::Number(reader.read_f64()?)),
        ValueKind::Boolean => match reader.read_u8()? {
            0 => Ok(PropertyValue::Boolean(false)),
            1 => Ok(PropertyValue::Boolean(true)),
            value => Err(BridgeFailure::wire(
                "INVALID_BOOLEAN",
                format!("Boolean payload must be 0 or 1, got {value}."),
                Some(reader.pos - 1),
            )),
        },
        ValueKind::String => Ok(PropertyValue::String(read_string(reader, strings)?)),
    }
}

fn read_string(reader: &mut Reader<'_>, strings: &[&str]) -> Result<String, BridgeFailure> {
    let offset = reader.pos;
    let index = reader.read_u32()? as usize;
    strings
        .get(index)
        .map(|value| (*value).to_owned())
        .ok_or_else(|| {
            BridgeFailure::wire(
                "INVALID_STRING_INDEX",
                format!("String-table index {index} is out of bounds."),
                Some(offset),
            )
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    fn empty_batch(version: u16) -> Vec<u8> {
        let mut bytes = vec![0; HEADER_BYTES];
        bytes[0..4].copy_from_slice(&PROTOCOL_MAGIC.to_le_bytes());
        bytes[4..6].copy_from_slice(&version.to_le_bytes());
        bytes[16..20].copy_from_slice(&(HEADER_BYTES as u32).to_le_bytes());
        bytes
    }

    #[derive(serde::Deserialize)]
    struct GoldenVector {
        name: String,
        hex: String,
    }

    fn hex_bytes(hex: &str) -> Vec<u8> {
        assert_eq!(hex.len() % 2, 0, "golden vector hex must contain whole bytes");
        (0..hex.len())
            .step_by(2)
            .map(|offset| u8::from_str_radix(&hex[offset..offset + 2], 16).unwrap())
            .collect()
    }

    const REQUIRED_GOLDEN_VECTORS: [&str; 5] = [
        "nodes-and-text",
        "property-values",
        "style-and-structure",
        "event-subscriptions",
        "pseudo-style",
    ];

    fn golden_hex<'a>(vectors: &'a [GoldenVector], name: &str) -> &'a str {
        vectors
            .iter()
            .find(|vector| vector.name == name)
            .unwrap_or_else(|| panic!("missing protocol golden vector: {name}"))
            .hex
            .as_str()
    }

    fn assert_golden(vectors: &[GoldenVector], name: &str, commands: Vec<Command>) {
        assert_eq!(
            decode_command_batch(&hex_bytes(golden_hex(vectors, name))).unwrap(),
            commands,
            "golden vector {name}"
        );
    }

    #[test]
    fn decodes_protocol_golden_vectors() {
        let vectors: Vec<GoldenVector> =
            serde_json::from_str(include_str!("../protocol-golden-vectors.json")).unwrap();
        let mut actual_names: Vec<_> = vectors.iter().map(|vector| vector.name.as_str()).collect();
        let mut required_names = REQUIRED_GOLDEN_VECTORS.to_vec();
        actual_names.sort_unstable();
        required_names.sort_unstable();
        assert_eq!(actual_names, required_names);

        assert_golden(
            &vectors,
            "nodes-and-text",
            vec![
                Command::CreateNode {
                    id: 1,
                    kind: ElementKind::Container,
                },
                Command::CreateText {
                    id: 2,
                    text: "hello".into(),
                },
                Command::UpdateText {
                    id: 2,
                    text: "world".into(),
                },
            ],
        );
        assert_golden(
            &vectors,
            "property-values",
            vec![
                Command::SetProperty {
                    id: 7,
                    property: PropertyId::Placeholder,
                    value: PropertyValue::String("value".into()),
                },
                Command::SetProperty {
                    id: 7,
                    property: PropertyId::MinRows,
                    value: PropertyValue::Number(3.5),
                },
                Command::SetProperty {
                    id: 7,
                    property: PropertyId::ReadOnly,
                    value: PropertyValue::Boolean(true),
                },
                Command::SetProperty {
                    id: 7,
                    property: PropertyId::ReadOnly,
                    value: PropertyValue::Boolean(false),
                },
                Command::SetProperty {
                    id: 7,
                    property: PropertyId::Value,
                    value: PropertyValue::Null,
                },
            ],
        );
        assert_golden(
            &vectors,
            "style-and-structure",
            vec![
                Command::SetStyle {
                    id: 10,
                    properties: vec![
                        (PropertyId::Width, PropertyValue::String("50%".into())),
                        (PropertyId::Opacity, PropertyValue::Number(0.5)),
                        (PropertyId::Color, PropertyValue::Null),
                    ],
                },
                Command::InsertChild {
                    parent_id: 10,
                    child_id: 11,
                    before_id: 0,
                },
                Command::InsertChild {
                    parent_id: 10,
                    child_id: 12,
                    before_id: 11,
                },
                Command::RemoveChild {
                    parent_id: 10,
                    child_id: 11,
                },
            ],
        );
        assert_golden(
            &vectors,
            "event-subscriptions",
            vec![
                Command::SubscribeEvent {
                    id: 5,
                    event: NativeEventId::Click,
                },
                Command::UnsubscribeEvent {
                    id: 5,
                    event: NativeEventId::MouseMove,
                },
            ],
        );
        assert_golden(
            &vectors,
            "pseudo-style",
            vec![
                Command::SetPseudoStyle {
                    id: 9,
                    state: StyleState::Hover,
                    properties: vec![
                        (PropertyId::Opacity, PropertyValue::Number(0.75)),
                        (
                            PropertyId::TransitionProperty,
                            PropertyValue::String("opacity".into()),
                        ),
                    ],
                },
                Command::SetPseudoStyle {
                    id: 9,
                    state: StyleState::Active,
                    properties: vec![(PropertyId::Opacity, PropertyValue::Number(0.25))],
                },
            ],
        );
    }

    #[test]
    fn decodes_native_event_subscription_commands() {
        let mut bytes = empty_batch(PROTOCOL_VERSION);
        bytes.push(Opcode::SubscribeEvent as u8);
        bytes.extend_from_slice(&7u32.to_le_bytes());
        bytes.extend_from_slice(&(NativeEventId::Click as u16).to_le_bytes());
        bytes.push(Opcode::UnsubscribeEvent as u8);
        bytes.extend_from_slice(&7u32.to_le_bytes());
        bytes.extend_from_slice(&(NativeEventId::Click as u16).to_le_bytes());
        bytes[8..12].copy_from_slice(&14u32.to_le_bytes());
        bytes[12..16].copy_from_slice(&2u32.to_le_bytes());
        bytes[16..20].copy_from_slice(&((HEADER_BYTES + 14) as u32).to_le_bytes());

        assert_eq!(
            decode_command_batch(&bytes).unwrap(),
            vec![
                Command::SubscribeEvent {
                    id: 7,
                    event: NativeEventId::Click,
                },
                Command::UnsubscribeEvent {
                    id: 7,
                    event: NativeEventId::Click,
                },
            ]
        );
    }

    #[test]
    fn rejects_unsupported_versions() {
        let error = decode_command_batch(&empty_batch(PROTOCOL_VERSION + 1)).unwrap_err();
        assert_eq!(error.code, "UNSUPPORTED_VERSION");
    }

    #[test]
    fn rejects_unknown_opcodes() {
        let mut bytes = empty_batch(PROTOCOL_VERSION);
        bytes.push(255);
        bytes[8..12].copy_from_slice(&1u32.to_le_bytes());
        bytes[12..16].copy_from_slice(&1u32.to_le_bytes());
        bytes[16..20].copy_from_slice(&((HEADER_BYTES + 1) as u32).to_le_bytes());
        let error = decode_command_batch(&bytes).unwrap_err();
        assert_eq!(error.code, "UNKNOWN_OPCODE");
    }

    #[test]
    fn rejects_invalid_string_indexes() {
        let mut bytes = empty_batch(PROTOCOL_VERSION);
        bytes.extend_from_slice(&[Opcode::CreateText as u8]);
        bytes.extend_from_slice(&2u32.to_le_bytes());
        bytes.extend_from_slice(&7u32.to_le_bytes());
        bytes[8..12].copy_from_slice(&9u32.to_le_bytes());
        bytes[12..16].copy_from_slice(&1u32.to_le_bytes());
        bytes[16..20].copy_from_slice(&((HEADER_BYTES + 9) as u32).to_le_bytes());
        let error = decode_command_batch(&bytes).unwrap_err();
        assert_eq!(error.code, "INVALID_STRING_INDEX");
    }

    #[test]
    fn rejects_truncated_fixed_schema_payloads() {
        let mut bytes = empty_batch(PROTOCOL_VERSION);
        bytes.extend_from_slice(&[Opcode::InsertChild as u8, 1, 0, 0, 0]);
        bytes[8..12].copy_from_slice(&5u32.to_le_bytes());
        bytes[12..16].copy_from_slice(&1u32.to_le_bytes());
        bytes[16..20].copy_from_slice(&((HEADER_BYTES + 5) as u32).to_le_bytes());
        let error = decode_command_batch(&bytes).unwrap_err();
        assert_eq!(error.code, "TRUNCATED_BUFFER");
    }

    #[test]
    fn rejects_impossible_command_counts_before_allocating() {
        let mut bytes = empty_batch(PROTOCOL_VERSION);
        bytes.push(Opcode::CreateNode as u8);
        bytes[8..12].copy_from_slice(&1u32.to_le_bytes());
        bytes[12..16].copy_from_slice(&u32::MAX.to_le_bytes());
        bytes[16..20].copy_from_slice(&((HEADER_BYTES + 1) as u32).to_le_bytes());
        let error = decode_command_batch(&bytes).unwrap_err();
        assert_eq!(error.code, "INVALID_COMMAND_COUNT");
    }

    #[test]
    fn rejects_impossible_string_counts_before_allocating() {
        let mut bytes = empty_batch(PROTOCOL_VERSION);
        bytes[20..24].copy_from_slice(&u32::MAX.to_le_bytes());
        let error = decode_command_batch(&bytes).unwrap_err();
        assert_eq!(error.code, "INVALID_STRING_COUNT");
    }

    proptest! {
        #[test]
        fn arbitrary_buffers_never_panic(bytes in proptest::collection::vec(any::<u8>(), 0..4096)) {
            let _ = decode_command_batch(&bytes);
        }
    }
}
