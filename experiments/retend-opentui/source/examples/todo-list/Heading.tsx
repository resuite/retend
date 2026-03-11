export function Heading() {
  return (
    <box
      borderColor="orange"
      marginBottom={2}
      paddingY={1}
      width="100%"
      alignItems="center"
      justifyContent="center"
      borderStyle="double"
    >
      <box alignItems="center">
        <ascii_font text="TODO" font="block" color="orange" />
        <text fg="gray">reactive terminal workflow</text>
      </box>
    </box>
  );
}
