export function Heading() {
  return (
    <box
      borderColor="orange"
      marginBottom={2}
      height={3}
      width="100%"
      alignItems="center"
      justifyContent="center"
      borderStyle="double"
    >
      <box>
        <b fg="blue" marginBottom={1}>
          TODO LIST
        </b>
      </box>
    </box>
  );
}
