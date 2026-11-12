// Renders loading and error states for a useAsync() result; children get the data.
export default function Async({ state, children }) {
  if (state.error) {
    return (
      <p className="err">
        {state.error.message}{' '}
        <button className="linkbtn" onClick={state.reload}>Try again</button>
      </p>
    );
  }
  if (state.loading && !state.data) return <p className="muted">Loading...</p>;
  if (!state.data) return null;
  return children(state.data);
}
