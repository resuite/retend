| title                | impact | impactDescription                                      | tags                        |
| :------------------- | :----- | :----------------------------------------------------- | :-------------------------- |
| Query Mutations Are Async | Medium | Prevents race conditions and timing bugs.              | router, queries, async      |

# Query Mutations Are Async

**Context**: Modifying URL query parameters.

**Rule**: Route query mutations (`set`, `append`, `delete`, `clear`) are async and trigger navigation.

**Why**:

- Query changes update the URL
- Navigation is asynchronous
- Code after query mutations may run before navigation completes

## Examples

### Invalid

```tsx
// INVALID - treating as synchronous
function FilterDropdown() {
  const query = useRouteQuery();
  
  const handleChange = (value) => {
    query.set('filter', value); // Returns Promise!
    fetchData(); // Might run with old query params
  };
  
  return <select onChange={handleChange}>...</select>;
}
```

### Valid

```tsx
// VALID - await query mutations
function FilterDropdown() {
  const query = useRouteQuery();
  
  const handleChange = async (value) => {
    await query.set('filter', value);
    fetchData(); // Now runs with updated query params
  };
  
  return <select onChange={handleChange}>...</select>;
}

// VALID - use Cell listeners for reactive updates
function DataList() {
  const query = useRouteQuery();
  const filterCell = query.get('filter'); // Returns Cell<string | null>
  
  const items = Cell.derived(async () => {
    const filter = filterCell.get();
    return await fetchFilteredItems(filter);
  });
  
  return <div>{For(items, item => <Item data={item} />)}</div>;
}
```

## Query API

All query mutation methods return Promises:

```tsx
const query = useRouteQuery();

// All of these return Promise<void>
await query.set('key', 'value');      // Set single value
await query.append('key', 'value');   // Append to array value
await query.delete('key');            // Remove parameter
await query.clear();                  // Remove all parameters

// Reading query values (synchronous)
const value = query.get('key');       // Returns Cell<string | null>
const exists = query.has('key');      // Returns Cell<boolean>
```

## Best Practice

Use reactive patterns instead of imperative updates:

```tsx
// Instead of manually updating and fetching
const handleChange = async (value) => {
  await query.set('filter', value);
  await fetchData();
};

// Use derived cells that react to query changes
const filteredData = Cell.derived(async () => {
  const filter = query.get('filter').get();
  return fetchData({ filter });
});
```
