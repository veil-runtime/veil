interface Capability {
  name: string;
  version: string;
  description: string;
  risk: string;
  inputSchema: Record<string, {
    type: string;
    required: boolean;
    description: string;
  }>;
}

interface CapabilityPanelProps {
  capability: Capability | undefined;
  name: string;
  onNameChange: (name: string) => void;
}

export function CapabilityPanel({
  capability,
  name,
  onNameChange,
}: CapabilityPanelProps) {
  return (
    <section className="panel">
      <p className="eyebrow">Capabilities</p>
      <h2>Something Veil is allowed to execute.</h2>
      {capability ? (
        <>
          <div className="capability-name">
            <strong>{capability.name}</strong>
            <span>Registered by Veil</span>
          </div>
          <p>{capability.description}</p>
          <label htmlFor="name">Name</label>
          <input
            id="name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Mustapha"
          />
          <p className="field-hint">
            Required {capability.inputSchema.name.type} input.
          </p>
        </>
      ) : (
        <p>Loading the capability registered with the runtime...</p>
      )}
    </section>
  );
}
