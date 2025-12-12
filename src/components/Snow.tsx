const Snow = () => {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      <div className="snow-layer snow-layer--far" />
      <div className="snow-layer snow-layer--mid" />
      <div className="snow-layer snow-layer--near" />
    </div>
  );
};

export default Snow;


