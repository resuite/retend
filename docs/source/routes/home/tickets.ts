/* The ticket example shared by the hero and the social preview image. */

export const SEATS = 12;
export const PRICE = 48;

export const ticketsCode = `
function Tickets() {
  const quantity = Cell.source(2);
  const seatsLeft = Cell.derived(() => 12 - quantity.get());
  const total = Cell.derived(() => quantity.get() * 48);

  const add = () => quantity.set(quantity.get() + 1);

  return (
    <>
      <button onClick={add}>Add a ticket</button>
      <p>{seatsLeft} of 12 seats left</p>
      <button type="submit">Pay \${total}</button>
    </>
  );
}
`;
