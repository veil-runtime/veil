// tools/showcase/node_modules/@veil-runtime/ui/dist/validation-safety.js
var limits = { depth: 32, nodes: 1e4, keys: 256, items: 1e3, string: 65536, bytes: 1048576 };
var reserved = /* @__PURE__ */ new Set(["__proto__", "prototype", "constructor"]);
function assertSafeKey(key) {
  if (reserved.has(key))
    throw new Error(`Reserved data key: ${key}`);
}
function assertBoundedData(value) {
  const ancestors = /* @__PURE__ */ new Set();
  let nodes = 0;
  let bytes = 0;
  function visit(item, depth) {
    if (++nodes > limits.nodes || depth > limits.depth)
      throw new Error("Data traversal limit exceeded");
    bytes += 8;
    if (typeof item === "number" && !Number.isFinite(item))
      throw new Error("Data value must be numeric and finite");
    if (typeof item === "string") {
      if (item.length > limits.string)
        throw new Error("Data string limit exceeded");
      bytes += item.length * 3;
    } else if (item !== null && typeof item === "object") {
      if (ancestors.has(item))
        throw new Error("Cyclic data is not supported");
      const array = Array.isArray(item);
      const proto = Object.getPrototypeOf(item);
      if (!array && proto !== Object.prototype && proto !== null)
        throw new Error("Data must use plain own properties");
      if (array && item.length > limits.items)
        throw new Error("Data collection limit exceeded");
      const keys = Reflect.ownKeys(item);
      if (keys.length > (array ? limits.items + 1 : limits.keys))
        throw new Error("Data property limit exceeded");
      if (array && keys.length !== item.length + 1)
        throw new Error("Data arrays must be dense without extra properties");
      ancestors.add(item);
      for (const key of keys) {
        if (array && key === "length")
          continue;
        if (typeof key !== "string")
          throw new Error("Symbol data keys are not supported");
        if (array && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= item.length))
          throw new Error("Data arrays cannot contain extra properties");
        if (key.length > limits.string)
          throw new Error("Data key limit exceeded");
        assertSafeKey(key);
        const descriptor2 = Object.getOwnPropertyDescriptor(item, key);
        if (!descriptor2.enumerable || !("value" in descriptor2))
          throw new Error("Non-enumerable or accessor data is not supported");
        bytes += key.length * 3;
        visit(descriptor2.value, depth + 1);
      }
      ancestors.delete(item);
    } else if (!["undefined", "boolean", "number"].includes(typeof item) && item !== null) {
      throw new Error("Unsupported data value");
    }
    if (bytes > limits.bytes)
      throw new Error("Data byte limit exceeded");
  }
  visit(value, 0);
}
function copyData(value) {
  assertBoundedData(value);
  function copy(item) {
    if (Array.isArray(item))
      return item.map(copy);
    if (item !== null && typeof item === "object") {
      return Object.fromEntries(Object.entries(item).map(([key, child]) => [key, copy(child)]));
    }
    return item;
  }
  return copy(value);
}

// tools/showcase/node_modules/@veil-runtime/ui/dist/interface-transaction.js
var renderers = /* @__PURE__ */ new WeakMap();
function attachInterfaceRenderers(controller, participants) {
  renderers.set(controller, participants);
}
function detachInterfaceRenderers(controller) {
  renderers.delete(controller);
}
function registerInterfaceRenderer(controller, renderer) {
  const participants = renderers.get(controller);
  if (!participants)
    throw new Error("Interface controller is disposed or unsupported");
  participants.add(renderer);
  return () => {
    participants.delete(renderer);
  };
}

// tools/showcase/node_modules/@veil-runtime/ui/dist/interface.js
var identifier = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/;
var commonProperties = ["key", "component", "visible", "ariaLabel"];
var vocabulary = {
  Stack: { properties: [...commonProperties, "children"], required: [], children: true, event: null },
  Row: { properties: [...commonProperties, "children"], required: [], children: true, event: null },
  Text: { properties: [...commonProperties, "text"], required: [], children: false, event: null },
  Heading: { properties: [...commonProperties, "text"], required: ["text"], children: false, event: null },
  Status: { properties: [...commonProperties, "text"], required: [], children: false, event: null },
  Input: { properties: [...commonProperties, "label", "binding", "inputType", "validation"], required: ["label", "binding"], children: false, event: "state change" },
  Textarea: { properties: [...commonProperties, "label", "binding", "validation"], required: ["label", "binding"], children: false, event: "state change" },
  Select: { properties: [...commonProperties, "label", "binding", "validation", "options"], required: ["label", "binding", "options"], children: false, event: "state change" },
  Button: { properties: [...commonProperties, "text", "action", "disabled", "validate"], required: ["text", "action"], children: false, event: "action" },
  Table: { properties: [...commonProperties, "binding", "columns"], required: ["binding", "columns"], children: false, event: null },
  List: { properties: [...commonProperties, "binding"], required: ["binding"], children: false, event: null }
};
var builtins = new Set(Object.keys(vocabulary));
var nodeKeys = /* @__PURE__ */ new Set(["key", "component", "children", "text", "binding", "visible", "action", "label", "inputType", "columns", "ariaLabel", "disabled", "validation", "options", "validate"]);
var plain = (value) => !!value && typeof value === "object" && !Array.isArray(value);
var exact = (value, allowed) => {
  for (const key of Object.keys(value))
    if (!allowed.has(key))
      throw new Error(`Unknown interface property: ${key}`);
};
var name = (value) => typeof value === "string" && identifier.test(value);
var scalar = (value) => value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value);
function binding(value) {
  if (!plain(value))
    throw new Error("Invalid binding");
  exact(value, /* @__PURE__ */ new Set(["source", "path"]));
  if (value.source !== "data" && value.source !== "state" || !name(value.path))
    throw new Error("Invalid binding");
  for (const part of value.path.split("."))
    assertSafeKey(part);
}
function valueAt(source, path) {
  let value = source;
  for (const part of path.split("."))
    value = plain(value) && Object.hasOwn(value, part) ? value[part] : void 0;
  return value;
}
function visitNodes(node, callback) {
  callback(node);
  for (const child of node.children ?? [])
    visitNodes(child, callback);
}
function validateBindings(definition, data, state) {
  visitNodes(definition.screen, (node) => {
    if (node.component === "Table") {
      const rows = valueAt(node.binding.source === "data" ? data : state, node.binding.path);
      if (rows === void 0)
        return;
      if (!Array.isArray(rows) || rows.length > 100 || rows.some((row) => !plain(row)))
        throw new Error("Invalid or oversized table rows");
      for (const row of rows)
        for (const col of node.columns ?? [])
          if (Object.hasOwn(row, col.key) && !scalar(row[col.key]))
            throw new Error("Invalid table cell");
    }
    if (node.component === "List") {
      const items = valueAt(node.binding.source === "data" ? data : state, node.binding.path);
      if (items !== void 0 && (!Array.isArray(items) || items.length > 100 || items.some((item) => !scalar(item))))
        throw new Error("Invalid or oversized list items");
    }
    if (isInterfaceField(node)) {
      const current = valueAt(state, node.binding.path);
      if (current !== void 0 && !scalar(current))
        throw new Error("Invalid input state");
    }
  });
}
function retainedState(previous, next, oldState) {
  const state = copyData(next.state ?? {});
  if (previous.id !== next.id)
    return state;
  const inputs = /* @__PURE__ */ new Map();
  visitNodes(previous.screen, (node) => {
    if (isInterfaceField(node))
      inputs.set(node.key, node);
  });
  visitNodes(next.screen, (node) => {
    if (!isInterfaceField(node))
      return;
    const old = inputs.get(node.key);
    if (!old || old.component !== node.component || old.inputType !== node.inputType || old.binding?.path !== node.binding?.path)
      return;
    const path = node.binding.path;
    const oldValue = valueAt(oldState, path);
    const defaultValue = valueAt(state, path);
    if (!scalar(oldValue) || defaultValue === void 0 || typeof oldValue !== typeof defaultValue)
      return;
    const parts = path.split(".");
    let target = state;
    for (const part of parts.slice(0, -1)) {
      if (!plain(target[part]))
        return;
      target = target[part];
    }
    target[parts.at(-1)] = oldValue;
  });
  return state;
}
function validateInterfaceDefinition(value, components = []) {
  assertBoundedData(value);
  if (!plain(value))
    throw new Error("Invalid interface definition");
  exact(value, /* @__PURE__ */ new Set(["id", "screen", "actions", "data", "state"]));
  if (!name(value.id) || !plain(value.screen))
    throw new Error("Invalid interface identity or screen");
  for (const key of ["data", "state"])
    if (value[key] !== void 0 && !plain(value[key]))
      throw new Error(`Invalid ${key}`);
  if (value.actions !== void 0 && (!Array.isArray(value.actions) || value.actions.some((action) => !name(action)) || new Set(value.actions).size !== value.actions.length))
    throw new Error("Invalid actions");
  const actions = value.actions ?? [];
  if (components.some((component) => !name(component) || builtins.has(component)) || new Set(components).size !== components.length)
    throw new Error("Invalid component registry");
  const known = /* @__PURE__ */ new Set([...builtins, ...components]);
  const keys = /* @__PURE__ */ new Set();
  let count = 0;
  function visit(node, depth) {
    if (!plain(node) || depth > 16 || ++count > 512)
      throw new Error("Interface tree limit exceeded");
    exact(node, nodeKeys);
    if (!name(node.key) || keys.has(node.key))
      throw new Error("Invalid or duplicate node key");
    keys.add(node.key);
    if (typeof node.component !== "string" || !known.has(node.component))
      throw new Error(`Unknown component: ${String(node.component)}`);
    if (builtins.has(node.component)) {
      const spec = vocabulary[node.component];
      for (const property of Object.keys(node))
        if (!spec.properties.includes(property))
          throw new Error(`Unsupported ${node.component} property: ${property}`);
      for (const property of spec.required)
        if (node[property] === void 0)
          throw new Error(`${node.component} needs ${property}`);
    }
    if (node.text !== void 0) {
      if (typeof node.text === "string") {
        if (node.text.length > 4096)
          throw new Error("Text limit exceeded");
      } else
        binding(node.text);
    }
    if (node.binding !== void 0)
      binding(node.binding);
    if (node.visible !== void 0)
      validateCondition(node.visible);
    if (node.disabled !== void 0) {
      if (node.component !== "Button")
        throw new Error("Only Button accepts disabled");
      validateCondition(node.disabled);
    }
    for (const field of ["label", "ariaLabel"])
      if (node[field] !== void 0 && (typeof node[field] !== "string" || node[field].length > 256))
        throw new Error(`Invalid ${field}`);
    if (node.action !== void 0 && (!name(node.action) || !actions.includes(node.action)))
      throw new Error("Action is not declared by the host");
    if (node.inputType !== void 0 && !["text", "number", "checkbox"].includes(node.inputType))
      throw new Error("Invalid input type");
    if (node.validate !== void 0 && (node.component !== "Button" || typeof node.validate !== "boolean"))
      throw new Error("Invalid validate flag");
    if (node.options !== void 0) {
      if (node.component !== "Select" || !Array.isArray(node.options) || node.options.length < 1 || node.options.length > 100)
        throw new Error("Invalid select options");
      const values = /* @__PURE__ */ new Set();
      for (const option of node.options) {
        if (!plain(option))
          throw new Error("Invalid option");
        exact(option, /* @__PURE__ */ new Set(["value", "label"]));
        if (typeof option.value !== "string" || option.value.length > 256 || typeof option.label !== "string" || option.label.length > 256 || values.has(option.value))
          throw new Error("Invalid option");
        values.add(option.value);
      }
    }
    if (node.validation !== void 0) {
      if (!isInterfaceField(node) || !plain(node.validation))
        throw new Error("Invalid validation");
      exact(node.validation, /* @__PURE__ */ new Set(["required", "minLength", "maxLength", "min", "max"]));
      const rules = node.validation;
      if (rules.required !== void 0 && typeof rules.required !== "boolean")
        throw new Error("Invalid required rule");
      for (const key of ["minLength", "maxLength", "min", "max"])
        if (rules[key] !== void 0 && (typeof rules[key] !== "number" || !Number.isFinite(rules[key])))
          throw new Error("Invalid validation bound");
      for (const key of ["minLength", "maxLength"])
        if (rules[key] !== void 0 && (!Number.isInteger(rules[key]) || rules[key] < 0 || rules[key] > 4096 || node.inputType === "number" || node.inputType === "checkbox"))
          throw new Error("Invalid length rule");
      if ((rules.min !== void 0 || rules.max !== void 0) && (node.component !== "Input" || node.inputType !== "number"))
        throw new Error("Numeric rules require number input");
      if (rules.minLength > rules.maxLength || rules.min > rules.max)
        throw new Error("Reversed validation bounds");
    }
    if (node.columns !== void 0) {
      if (!Array.isArray(node.columns) || node.columns.length < 1 || node.columns.length > 20 || node.columns.some((col) => !plain(col) || Object.keys(col).some((key) => key !== "key" && key !== "label") || !name(col.key) || typeof col.label !== "string" || col.label.length > 256))
        throw new Error("Invalid table columns");
    }
    if (isInterfaceField(node) && (!node.binding || node.binding.source !== "state" || !node.label))
      throw new Error("Input needs a state binding and label");
    if (node.component === "Button" && (!node.action || !node.text))
      throw new Error("Button needs an action and text");
    if (node.component === "Table" && (!node.binding || !node.columns))
      throw new Error("Table needs rows and columns");
    if (node.component !== "Button" && node.action !== void 0)
      throw new Error("Only Button accepts an action");
    if (node.component !== "Input" && node.inputType !== void 0)
      throw new Error("Only Input accepts inputType");
    if (node.component !== "Table" && node.columns !== void 0)
      throw new Error("Only Table accepts columns");
    if (node.children !== void 0 && (!Array.isArray(node.children) || !["Stack", "Row"].includes(node.component) && !components.includes(node.component)))
      throw new Error("Invalid children");
    for (const child of node.children ?? [])
      visit(child, depth + 1);
  }
  visit(value.screen, 0);
  validateBindings(value, value.data ?? {}, value.state ?? {});
}
function createInterfaceController(definition, options = {}) {
  const components = options.components ?? [];
  validateInterfaceDefinition(definition, components);
  if (options.allowedActions && definition.actions?.some((action) => !options.allowedActions.includes(action)))
    throw new Error("Action is not allowed by host");
  let current = copyData(definition);
  let data = copyData(definition.data ?? {});
  let state = copyData(definition.state ?? {});
  validateBindings(current, data, state);
  let revision = 0;
  let disposed = false;
  let dispatching = false;
  let emitting = false;
  let pending = false;
  let updating = false;
  const listeners = /* @__PURE__ */ new Set();
  const participants = /* @__PURE__ */ new Set();
  const copySnapshot = (value) => ({
    definition: copyData(value.definition),
    data: copyData(value.data),
    state: copyData(value.state),
    revision: value.revision
  });
  const snapshot = () => copySnapshot({ definition: current, data, state, revision });
  const report = (error) => {
    try {
      options.onError?.(error);
    } catch {
    }
  };
  const emit = () => {
    if (emitting) {
      pending = true;
      return;
    }
    emitting = true;
    try {
      let passes = 0;
      do {
        pending = false;
        const accepted = snapshot();
        for (const listener of listeners) {
          try {
            listener(copySnapshot(accepted));
          } catch (error) {
            report(error);
          }
          if (revision !== accepted.revision) {
            pending = true;
            break;
          }
        }
        if (++passes >= 32 && pending) {
          report(new Error("Interface update loop limit exceeded"));
          pending = false;
          break;
        }
      } while (pending && !disposed);
    } finally {
      emitting = false;
    }
  };
  const accept = (nextDefinition, nextData, nextState) => {
    if (updating)
      throw new Error("Interface update already in progress");
    updating = true;
    const prepared = [];
    try {
      const candidate = { definition: nextDefinition, data: nextData, state: nextState, revision: revision + 1 };
      for (const renderer of participants)
        prepared.push(renderer(copySnapshot(candidate)));
      if (disposed)
        throw new Error("Interface controller was disposed during update");
      for (const renderer of prepared) {
        renderer.commit();
        if (disposed)
          throw new Error("Interface controller was disposed during update");
      }
      current = nextDefinition;
      data = nextData;
      state = nextState;
      revision++;
    } catch (error) {
      for (const renderer of prepared.reverse()) {
        try {
          renderer.discard();
        } catch (cleanupError) {
          report(cleanupError);
        }
      }
      throw error;
    } finally {
      updating = false;
    }
    emit();
  };
  const controller = {
    snapshot,
    updateData(next, expectedRevision) {
      if (disposed || expectedRevision !== void 0 && expectedRevision !== revision)
        return false;
      if (updating)
        throw new Error("Interface update already in progress");
      assertBoundedData(next);
      if (!plain(next))
        throw new Error("Invalid data");
      const copy = copyData(next);
      validateBindings(current, copy, state);
      accept(current, copy, state);
      return true;
    },
    updateDefinition(next, expectedRevision) {
      if (disposed || expectedRevision !== void 0 && expectedRevision !== revision)
        return false;
      if (updating)
        throw new Error("Interface update already in progress");
      validateInterfaceDefinition(next, components);
      if (options.allowedActions && next.actions?.some((action) => !options.allowedActions.includes(action)))
        throw new Error("Action is not allowed by host");
      const copy = copyData(next);
      const nextData = copyData(copy.data ?? {});
      const nextState = retainedState(current, copy, state);
      assertBoundedData(nextState);
      validateBindings(copy, nextData, nextState);
      accept(copy, nextData, nextState);
      return true;
    },
    setState(path, value) {
      if (disposed)
        return;
      if (updating)
        throw new Error("Interface update already in progress");
      if (!name(path) || !scalar(value))
        throw new Error("Invalid state update");
      const parts = path.split(".");
      for (const part of parts)
        assertSafeKey(part);
      const next = copyData(state);
      let target = next;
      for (const part of parts.slice(0, -1)) {
        const child = target[part];
        if (child !== void 0 && !plain(child))
          throw new Error("State path is not an object");
        if (child === void 0)
          target[part] = {};
        target = target[part];
      }
      target[parts.at(-1)] = value;
      assertBoundedData(next);
      validateBindings(current, data, next);
      accept(current, data, next);
    },
    dispatch(action, source) {
      if (disposed || dispatching)
        return;
      if (updating)
        throw new Error("Interface update already in progress");
      if (!current.actions?.includes(action) || !findAction(current.screen, source, action, data, state))
        throw new Error("Action is not available");
      let submit = false;
      visitNodes(current.screen, (node) => {
        if (node.key === source)
          submit = node.validate === true;
      });
      if (submit && Object.keys(getInterfaceValidation({ definition: current, data, state })).length)
        throw new Error("Interface validation failed");
      dispatching = true;
      try {
        const result = options.onEvent?.({ action, source, state: copyData(state), revision });
        if (result && typeof result === "object" && "then" in result)
          void Promise.resolve(result).catch(report);
      } catch (error) {
        report(error);
      } finally {
        dispatching = false;
      }
    },
    subscribe(listener) {
      if (disposed)
        throw new Error("Interface controller is disposed");
      listeners.add(listener);
      try {
        listener(snapshot());
      } catch (error) {
        listeners.delete(listener);
        throw error;
      }
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      disposed = true;
      listeners.clear();
      participants.clear();
      detachInterfaceRenderers(controller);
    }
  };
  attachInterfaceRenderers(controller, participants);
  return controller;
}
function findAction(node, key, action, data, state) {
  if (node.visible && !evaluateInterfaceCondition(node.visible, { data, state }))
    return false;
  if (node.disabled && evaluateInterfaceCondition(node.disabled, { data, state }))
    return false;
  return node.key === key && node.action === action || (node.children?.some((child) => findAction(child, key, action, data, state)) ?? false);
}
function resolveInterfaceBinding(snapshot, bindingValue) {
  return valueAt(bindingValue.source === "data" ? snapshot.data : snapshot.state, bindingValue.path);
}
function validateCondition(value) {
  let count = 0;
  function visit(value2, depth) {
    if (!plain(value2) || depth > 8 || ++count > 64)
      throw new Error("Invalid condition or condition limit exceeded");
    if (Object.hasOwn(value2, "all") || Object.hasOwn(value2, "any")) {
      const key = Object.hasOwn(value2, "all") ? "all" : "any";
      exact(value2, /* @__PURE__ */ new Set([key]));
      const terms = value2[key];
      if (!Array.isArray(terms) || terms.length < 1 || terms.length > 16)
        throw new Error("Invalid condition terms");
      for (const term of terms)
        visit(term, depth + 1);
    } else if (Object.hasOwn(value2, "not")) {
      exact(value2, /* @__PURE__ */ new Set(["not"]));
      visit(value2.not, depth + 1);
    } else {
      binding(value2.binding);
      if (Object.hasOwn(value2, "equals")) {
        exact(value2, /* @__PURE__ */ new Set(["binding", "equals"]));
        if (!scalar(value2.equals))
          throw new Error("Invalid condition value");
      } else {
        exact(value2, /* @__PURE__ */ new Set(["binding", "operator", "value"]));
        if (!["ne", "lt", "lte", "gt", "gte"].includes(value2.operator) || !scalar(value2.value))
          throw new Error("Invalid condition operator or value");
        if (value2.operator !== "ne" && typeof value2.value !== "number")
          throw new Error("Numeric condition needs a number");
      }
    }
  }
  visit(value, 0);
}
function evaluateInterfaceCondition(condition, snapshot) {
  if ("all" in condition)
    return condition.all.every((term) => evaluateInterfaceCondition(term, snapshot));
  if ("any" in condition)
    return condition.any.some((term) => evaluateInterfaceCondition(term, snapshot));
  if ("not" in condition)
    return !evaluateInterfaceCondition(condition.not, snapshot);
  const value = valueAt(snapshot[condition.binding.source], condition.binding.path);
  if ("equals" in condition)
    return value === condition.equals;
  if (condition.operator === "ne")
    return value !== condition.value;
  if (typeof value !== "number" || !Number.isFinite(value) || typeof condition.value !== "number")
    return false;
  switch (condition.operator) {
    case "lt":
      return value < condition.value;
    case "lte":
      return value <= condition.value;
    case "gt":
      return value > condition.value;
    case "gte":
      return value >= condition.value;
  }
}
function isInterfaceField(node) {
  return ["Input", "Textarea", "Select"].includes(node.component);
}
function getInterfaceValidation(snapshot) {
  const errors = {};
  function visit(node) {
    if (node.visible && !evaluateInterfaceCondition(node.visible, snapshot))
      return;
    if (isInterfaceField(node)) {
      const value = valueAt(snapshot.state, node.binding.path);
      const rules = node.validation ?? {};
      const empty = value === void 0 || value === null || value === "";
      let error = "";
      if (rules.required && (empty || node.inputType === "checkbox" && value !== true))
        error = "This field is required.";
      else if (!empty) {
        if (node.inputType === "number") {
          if (typeof value !== "number" || !Number.isFinite(value))
            error = "Enter a number.";
          else if (rules.min !== void 0 && value < rules.min)
            error = `Minimum value is ${rules.min}.`;
          else if (rules.max !== void 0 && value > rules.max)
            error = `Maximum value is ${rules.max}.`;
        } else if (node.inputType === "checkbox") {
          if (typeof value !== "boolean")
            error = "Enter a boolean.";
        } else if (typeof value !== "string")
          error = "Enter text.";
        else if (rules.minLength !== void 0 && value.length < rules.minLength)
          error = `Minimum length is ${rules.minLength}.`;
        else if (rules.maxLength !== void 0 && value.length > rules.maxLength)
          error = `Maximum length is ${rules.maxLength}.`;
        else if (node.component === "Select" && !node.options.some((option) => option.value === value))
          error = "Choose an available option.";
      }
      if (error)
        errors[node.key] = error;
    }
    for (const child of node.children ?? [])
      visit(child);
  }
  visit(snapshot.definition.screen);
  return errors;
}

// tools/showcase/node_modules/@veil-runtime/ui/dist/dom.js
var instance = 0;
var mounted = /* @__PURE__ */ new WeakMap();
function createMountedInterface(target, definition, options = {}) {
  const components = options.components ?? {};
  const controller = createInterfaceController(definition, {
    components: Object.keys(components),
    ...options.allowedActions ? { allowedActions: options.allowedActions } : {},
    ...options.onEvent ? { onEvent: options.onEvent } : {},
    ...options.onError ? { onError: options.onError } : {}
  });
  let unmount;
  try {
    unmount = mountInterface(target, controller, components, options.onError);
  } catch (error) {
    controller.dispose();
    throw error;
  }
  let disposed = false;
  const disposeController = controller.dispose.bind(controller);
  return Object.assign(controller, {
    unmount,
    dispose() {
      if (disposed)
        return;
      disposed = true;
      unmount();
      disposeController();
    }
  });
}
function mountInterface(target, controller, components = {}, onError) {
  let active = true;
  let root;
  let unregister;
  const reported = /* @__PURE__ */ new WeakSet();
  const report = (error) => {
    if (error !== null && typeof error === "object") {
      if (reported.has(error))
        return;
      reported.add(error);
    }
    try {
      onError?.(error);
    } catch {
    }
  };
  const domId = `veil-interface-${++instance}`;
  const make = (tag, className) => {
    const el = document.createElement(tag);
    el.className = className;
    return el;
  };
  const display = (value) => value === void 0 || value === null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  const resolveText = (node, snapshot) => typeof node.text === "string" ? node.text : node.text ? display(resolveInterfaceBinding(snapshot, node.text)) : "";
  const visible = (node, snapshot) => !node.visible || evaluateInterfaceCondition(node.visible, snapshot);
  function create(node, snapshot, candidate = false) {
    const children = [];
    let element;
    let dispose2 = () => {
    };
    let updateCustom;
    let live = true;
    const lifetime = new AbortController();
    if (node.component === "Stack" || node.component === "Row")
      element = make("div", `veil-interface-${node.component.toLowerCase()}`);
    else if (node.component === "Text")
      element = make("p", "veil-interface-text");
    else if (node.component === "Heading")
      element = make("h2", "veil-interface-heading");
    else if (node.component === "Status") {
      element = make("p", "veil-interface-status");
      element.setAttribute("role", "status");
      element.setAttribute("aria-live", "polite");
    } else if (node.component === "Button") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "veil-interface-button";
      const click = () => {
        if (active && live) {
          try {
            controller.dispatch(node.action, node.key);
          } catch (error) {
            report(error);
          }
        }
      };
      button.addEventListener("click", click);
      dispose2 = () => button.removeEventListener("click", click);
      element = button;
    } else if (isInterfaceField(node)) {
      const wrapper = make("div", "veil-interface-input");
      const label = document.createElement("label");
      const input = document.createElement(node.component === "Textarea" ? "textarea" : node.component === "Select" ? "select" : "input");
      input.id = `${domId}-input-${node.key}`;
      label.htmlFor = input.id;
      if (input instanceof HTMLInputElement)
        input.type = node.inputType ?? "text";
      input.style.boxSizing = "border-box";
      input.style.maxWidth = "100%";
      input.style.minWidth = "0";
      const change = () => {
        if (!active || !live)
          return;
        const value = input instanceof HTMLInputElement && input.type === "checkbox" ? input.checked : input.type === "number" && input.value !== "" ? Number(input.value) : input.value;
        try {
          controller.setState(node.binding.path, value);
        } catch (error) {
          const accepted = resolveInterfaceBinding(controller.snapshot(), node.binding);
          if (input instanceof HTMLInputElement && input.type === "checkbox")
            input.checked = accepted === true;
          else
            input.value = display(accepted);
          report(error);
        }
      };
      input.addEventListener("input", change);
      input.addEventListener("change", change);
      dispose2 = () => {
        input.removeEventListener("input", change);
        input.removeEventListener("change", change);
      };
      const feedback2 = document.createElement("span");
      feedback2.id = `${domId}-feedback-${node.key}`;
      feedback2.setAttribute("aria-live", "polite");
      input.setAttribute("aria-describedby", feedback2.id);
      wrapper.append(label, input, feedback2);
      element = wrapper;
    } else if (node.component === "Table") {
      element = make("table", "veil-interface-table");
      element.style.display = "block";
      element.style.maxWidth = "100%";
      element.style.overflowX = "auto";
    } else if (node.component === "List")
      element = make("ul", "veil-interface-list");
    else {
      const custom = Object.hasOwn(components, node.component) ? components[node.component] : void 0;
      if (!custom)
        throw new Error(`Unknown component: ${node.component}`);
      let created;
      let renderedChildren = false;
      try {
        created = custom(node, { snapshot, signal: lifetime.signal, renderChildren: () => {
          if (renderedChildren)
            throw new Error("renderChildren may be called once");
          renderedChildren = true;
          for (const child of node.children ?? [])
            children.push(create(child, snapshot, candidate));
          return children.map((child) => child.element);
        } });
      } catch (error) {
        lifetime.abort();
        for (const child of children)
          destroy(child);
        throw error;
      }
      if (!created || typeof created !== "object") {
        lifetime.abort();
        for (const child of children)
          destroy(child);
        throw new Error(`Component ${node.component} must return an HTMLElement`);
      }
      const instance2 = created instanceof HTMLElement ? { element: created } : created;
      element = instance2.element;
      updateCustom = instance2.update;
      dispose2 = () => instance2.dispose?.();
      if (!(element instanceof HTMLElement)) {
        lifetime.abort();
        for (const child of children)
          destroy(child);
        throw new Error(`Component ${node.component} must return an HTMLElement`);
      }
    }
    const result = { node, element, children, dispose: () => {
      live = false;
      lifetime.abort();
      dispose2();
    }, updateCustom, visibleDisplay: element.style.display, live: true };
    if (node.component === "Stack" || node.component === "Row") {
      element.style.display = node.component === "Stack" ? "grid" : "flex";
      element.style.gap = "0.75rem";
      element.style.minWidth = "0";
      if (node.component === "Stack")
        element.style.gridTemplateColumns = "minmax(0, 1fr)";
      if (node.component === "Row")
        element.style.flexWrap = "wrap";
      try {
        for (const child of node.children ?? [])
          children.push(create(child, snapshot, candidate));
      } catch (error) {
        for (const child of children)
          destroy(child);
        throw error;
      }
      element.append(...children.map((child) => child.element));
    }
    result.visibleDisplay = element.style.display;
    update(result, snapshot);
    if (candidate && updateCustom) {
      try {
        updateCustom(node, snapshot);
      } catch (error) {
        destroy(result);
        throw error;
      }
    }
    return result;
  }
  function update(rendered, snapshot) {
    const { node, element } = rendered;
    const isVisible = visible(node, snapshot);
    element.hidden = !isVisible;
    if (node.component === "Button")
      element.disabled = !!node.disabled && evaluateInterfaceCondition(node.disabled, snapshot);
    element.style.display = isVisible ? rendered.visibleDisplay : "none";
    if (node.ariaLabel)
      element.setAttribute("aria-label", node.ariaLabel);
    else
      element.removeAttribute("aria-label");
    if (["Text", "Heading", "Status", "Button"].includes(node.component)) {
      const text = resolveText(node, snapshot);
      if (element.textContent !== text) {
        const child = element.firstChild;
        if (child?.nodeType === 3 && child === element.lastChild)
          child.nodeValue = text;
        else
          element.textContent = text;
      }
    }
    if (node.component === "List") {
      const items = resolveInterfaceBinding(snapshot, node.binding);
      if (items !== void 0 && (!Array.isArray(items) || items.length > 100))
        throw new Error("List item limit exceeded");
      const entries = (items ?? []).map((item) => {
        const li = document.createElement("li");
        li.textContent = display(item);
        return li;
      });
      element.replaceChildren(...entries);
    }
    if (isInterfaceField(node)) {
      const label = element.querySelector("label");
      const input = element.querySelector("input,select,textarea");
      if (input instanceof HTMLSelectElement) {
        input.replaceChildren(...[{ value: "", label: "Choose\u2026" }, ...node.options.filter((option) => option.value !== "")].map((option) => {
          const item = document.createElement("option");
          item.value = option.value;
          item.textContent = option.label;
          return item;
        }));
      }
      const errors = getInterfaceValidation(snapshot);
      const error = Object.hasOwn(errors, node.key) ? errors[node.key] : "";
      element.querySelector("span").textContent = error;
      input.setAttribute("aria-invalid", String(!!error));
      input.required = node.validation?.required === true;
      label.textContent = node.label ?? "";
      const value = resolveInterfaceBinding(snapshot, node.binding);
      if (input instanceof HTMLInputElement && input.type === "checkbox")
        input.checked = value === true;
      else {
        const shown = display(value);
        const sameNumber = input.type === "number" && input.value !== "" && typeof value === "number" && Number(input.value) === value;
        if (!sameNumber && input.value !== shown)
          input.value = shown;
      }
      if (node.ariaLabel)
        input.setAttribute("aria-label", node.ariaLabel);
      else
        input.removeAttribute("aria-label");
    }
    if (node.component === "Table") {
      const rows = resolveInterfaceBinding(snapshot, node.binding);
      if (rows !== void 0 && (!Array.isArray(rows) || rows.length > 100))
        throw new Error("Table row limit exceeded");
      const head = document.createElement("thead");
      const header = document.createElement("tr");
      for (const col of node.columns ?? []) {
        const cell = document.createElement("th");
        cell.scope = "col";
        cell.textContent = col.label;
        header.append(cell);
      }
      head.append(header);
      const body = document.createElement("tbody");
      for (const row of rows ?? []) {
        if (!row || typeof row !== "object" || Array.isArray(row))
          throw new Error("Invalid table row");
        const tr = document.createElement("tr");
        for (const col of node.columns ?? []) {
          const cell = document.createElement("td");
          cell.textContent = display(Object.hasOwn(row, col.key) ? row[col.key] : void 0);
          tr.append(cell);
        }
        body.append(tr);
      }
      element.replaceChildren(head, body);
    }
  }
  function destroy(rendered) {
    if (!rendered.live)
      return;
    rendered.live = false;
    try {
      rendered.dispose();
    } catch (error) {
      report(error);
    }
    for (const child of rendered.children)
      destroy(child);
  }
  function prepare(previous, node, snapshot, staged) {
    const same = previous.node.key === node.key && previous.node.component === node.component && (node.component !== "Button" || previous.node.action === node.action) && (!isInterfaceField(node) || previous.node.binding?.path === node.binding?.path && previous.node.inputType === node.inputType) && ["Stack", "Row", "Text", "Heading", "Status", "Input", "Textarea", "Select", "Button", "Table", "List"].includes(node.component);
    if (!same) {
      const next = create(node, snapshot, true);
      staged.push(next);
      return () => {
        previous.element.replaceWith(next.element);
        destroy(previous);
        return next;
      };
    }
    const prior = node.component === "Stack" || node.component === "Row" ? new Map(previous.children.map((child) => [child.node.key, child])) : void 0;
    const childPlans = (node.children ?? []).map((child) => {
      const old = prior?.get(child.key);
      if (old) {
        prior.delete(child.key);
        return prepare(old, child, snapshot, staged);
      }
      const next = create(child, snapshot, true);
      staged.push(next);
      return () => next;
    });
    return () => {
      previous.node = node;
      update(previous, snapshot);
      if (node.component === "Stack" || node.component === "Row") {
        const children = childPlans.map((plan) => plan());
        previous.children = children;
        for (let index = 0; index < children.length; index++) {
          const desired = children[index].element;
          if (previous.element.children[index] !== desired)
            previous.element.insertBefore(desired, previous.element.children[index] ?? null);
        }
        while (previous.element.children.length > children.length)
          previous.element.lastElementChild?.remove();
        for (const removed of prior.values())
          destroy(removed);
      }
      return previous;
    };
  }
  try {
    const first = controller.snapshot();
    root = create(first.definition.screen, first);
    unregister = registerInterfaceRenderer(controller, (snapshot) => {
      const staged = [];
      try {
        const commit = prepare(root, snapshot.definition.screen, snapshot, staged);
        return { commit: () => {
          if (!active) {
            for (const node of staged)
              destroy(node);
            return;
          }
          const focused = root?.element.contains(document.activeElement) ? document.activeElement : void 0;
          const selection = focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement ? { start: focused.selectionStart, end: focused.selectionEnd, direction: focused.selectionDirection } : void 0;
          root = commit();
          if (focused?.isConnected && document.activeElement !== focused) {
            focused.focus({ preventScroll: true });
            if (selection && selection.start !== null && selection.end !== null && (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement))
              focused.setSelectionRange(selection.start, selection.end, selection.direction ?? void 0);
          }
        }, discard: () => {
          for (const node of staged)
            destroy(node);
        } };
      } catch (error) {
        for (const node of staged)
          destroy(node);
        report(error);
        throw error;
      }
    });
    mounted.get(target)?.();
    target.replaceChildren(root.element);
  } catch (error) {
    unregister?.();
    if (root)
      destroy(root);
    active = false;
    throw error;
  }
  const dispose = () => {
    if (!active)
      return;
    active = false;
    unregister?.();
    if (root) {
      destroy(root);
      if (root.element.parentNode === target)
        target.removeChild(root.element);
    }
    if (mounted.get(target) === dispose)
      mounted.delete(target);
  };
  mounted.set(target, dispose);
  return dispose;
}

// docs/assets/showcase/lab-definition.mjs
var bind = (path) => ({ source: "state", path });
var btn = (key, text) => ({ key, component: "Button", text, action: key });
var txt = (key, text) => ({ key, component: "Text", text });
var status = (text) => ({ key: "status", component: "Status", text });
var screen = (id, title, children, state = {}) => ({
  id,
  actions: ["next", "approve", "reject", "retry", "reset", "run", "stop", "invalid"],
  state,
  screen: { key: "screen", component: "Stack", children: [{ key: "heading", component: "Heading", text: title }, ...children] }
});
var scenarios = {
  incident: { title: "Incident investigation", summary: "Model suggests investigating elevated error rates.", decision: "Review evidence and approve an escalation." },
  request: { title: "Request approval", summary: "Model extracts a proposed access request.", decision: "Approve or reject the request." },
  analysis: { title: "Operational analysis", summary: "Model identifies a capacity trend.", decision: "Accept or reject a follow-up review." }
};
function descriptor(kind2, step, model) {
  if (kind2 === "llm") {
    const item = scenarios[model.scenario];
    if (step === "input") return screen("llm-input", "LLM to UI \xB7 simulated output", [
      txt("explain", "Choose an authored model response. No model is called."),
      { key: "scenario", component: "Select", label: "Scenario", binding: bind("scenario"), options: Object.entries(scenarios).map(([value, v]) => ({ value, label: v.title })) },
      btn("next", "Generate descriptor"),
      btn("invalid", "Try invalid output")
    ], { scenario: model.scenario });
    if (step === "done") return screen("llm-done", "Local decision recorded", [status(model.message), btn("reset", "New scenario")]);
    if (step === "error") return screen("llm-error", "Output rejected", [status("Invalid descriptor rejected. The last accepted interface is safe."), btn("retry", "Recover")]);
    return screen("llm-review", item.title, [status("Simulated model output \xB7 validated descriptor"), txt("summary", item.summary), txt("decision", item.decision), btn("approve", "Approve locally"), btn("reject", "Reject locally"), btn("reset", "New scenario")]);
  }
  if (kind2 === "operations") {
    const rows = model.history.slice(-6).map((entry, i) => ({ time: String(i + 1), event: entry }));
    return { ...screen("operations", "Operations console \xB7 simulation", [status(`Service ${model.health} \xB7 job ${model.job}`), txt("diagnostic", model.diagnostic), { key: "history", component: "Table", ariaLabel: "Execution history", binding: { source: "data", path: "history" }, columns: [{ key: "time", label: "#" }, { key: "event", label: "Event" }] }, btn("run", "Run job"), btn("stop", "Simulate failure"), btn("retry", "Retry job"), btn("reset", "Reset simulation")]), data: { history: rows } };
  }
  if (step === "input") return screen("workflow-input", "Request \xB7 capture", [
    txt("help", "Enter a title and reason for a simulated request."),
    { key: "title", component: "Input", label: "Request title", binding: bind("title"), validation: { required: true } },
    { key: "reason", component: "Textarea", label: "Reason", binding: bind("reason"), validation: { required: true } },
    btn("next", "Validate and review")
  ], model.form);
  if (step === "review") return screen("workflow-review", "Review request", [status(`Title: ${model.form.title} \xB7 Reason: ${model.form.reason}`), btn("approve", "Approve"), btn("reject", "Reject"), btn("retry", "Edit request")]);
  return screen("workflow-done", "Request confirmation", [status(model.message), btn("reset", "Start another request")]);
}

// docs/assets/showcase/lab.mjs
function mountLab(target, kind2, onError = () => {
}) {
  const model = { scenario: "incident", health: "healthy", job: "idle", diagnostic: "Scheduler is ready; no infrastructure is connected.", history: ["Ready"], form: { title: "", reason: "" }, message: "" };
  let step = "input", disposed = false, ticket = 0, ui;
  const allowed = ["next", "approve", "reject", "retry", "reset", "run", "stop", "invalid"];
  const change = (next) => {
    if (disposed) return;
    const candidate = descriptor(kind2, next, model);
    if (new TextEncoder().encode(JSON.stringify(candidate)).length > 32768) throw Error("Descriptor too large");
    validateInterfaceDefinition(candidate);
    if (ui.updateDefinition(candidate, ui.snapshot().revision)) step = next;
  };
  const initial = descriptor(kind2, step, model);
  validateInterfaceDefinition(initial);
  ui = createMountedInterface(target, initial, { allowedActions: allowed, onError: () => onError("Rendering failed. Reload to recover."), onEvent(event) {
    if (disposed || event.revision !== ui.snapshot().revision || event.source !== event.action || !allowed.includes(event.action)) return;
    try {
      if (kind2 === "llm") {
        if (event.action === "invalid") {
          try {
            validateInterfaceDefinition({ id: "unsafe", actions: ["unapproved"], screen: { key: "bad", component: "Script" } });
          } catch {
            change("error");
          }
        } else if (event.action === "next" && step === "input") {
          model.scenario = ["incident", "request", "analysis"].includes(event.state.scenario) ? event.state.scenario : "incident";
          change("review");
        } else if (event.action === "retry" || event.action === "reset") change("input");
        else if ((event.action === "approve" || event.action === "reject") && step === "review") {
          model.message = event.action === "approve" ? "Approved in this browser only." : "Rejected in this browser only.";
          change("done");
        }
      } else if (kind2 === "operations") {
        if (event.action === "reset") {
          ticket++;
          model.health = "healthy";
          model.job = "idle";
          model.history = ["Ready"];
          model.diagnostic = "Scheduler is ready; no infrastructure is connected.";
        } else if (event.action === "stop") {
          ticket++;
          model.health = "degraded";
          model.job = "failed";
          model.diagnostic = "Simulated worker timeout. Retry is available.";
          model.history.push("Job failed: timeout");
        } else if (event.action === "run" || event.action === "retry") {
          const id = ++ticket;
          model.job = "running";
          model.history.push("Job started");
          setTimeout(() => {
            if (disposed || ticket !== id) return;
            model.job = "complete";
            model.health = "healthy";
            model.diagnostic = "Simulated job completed.";
            model.history.push("Job complete");
            change("input");
          }, 500);
        }
        model.history = model.history.slice(-20);
        change("input");
      } else {
        if (event.action === "next" && step === "input") {
          const title = String(event.state.title || "").trim(), reason = String(event.state.reason || "").trim();
          if (!title || !reason || title.length > 120 || reason.length > 500) {
            onError("Enter a title and reason within the field limits.");
            return;
          }
          model.form = { title, reason };
          change("review");
        } else if (event.action === "retry" && step === "review") change("input");
        else if ((event.action === "approve" || event.action === "reject") && step === "review") {
          model.message = `Request ${event.action === "approve" ? "approved" : "rejected"} in this browser only.`;
          change("done");
        } else if (event.action === "reset") {
          model.form = { title: "", reason: "" };
          change("input");
        }
      }
    } catch {
      onError("The candidate interface was rejected. The accepted interface remains available.");
    }
  } });
  return { snapshot: () => ui.snapshot(), subscribe: (listener) => ui.subscribe(listener), dispose() {
    disposed = true;
    ticket++;
    ui.dispose();
  } };
}

// lab:labSources
var sources = { "lab.mjs": "import { createMountedInterface } from '@veil-runtime/ui/dom';\nimport { validateInterfaceDefinition } from '@veil-runtime/ui/interface';\n\nimport { descriptor } from './lab-definition.mjs';\nexport function mountLab(target, kind, onError = () => {}) {\n  const model = {scenario:'incident',health:'healthy',job:'idle',diagnostic:'Scheduler is ready; no infrastructure is connected.',history:['Ready'],form:{title:'',reason:''},message:''};\n  let step = 'input', disposed = false, ticket = 0, ui;\n  const allowed = ['next','approve','reject','retry','reset','run','stop','invalid'];\n  const change = next => { if (disposed) return; const candidate=descriptor(kind,next,model); if (new TextEncoder().encode(JSON.stringify(candidate)).length>32768) throw Error('Descriptor too large'); validateInterfaceDefinition(candidate); if (ui.updateDefinition(candidate,ui.snapshot().revision)) step=next; };\n  const initial=descriptor(kind,step,model); validateInterfaceDefinition(initial);\n  ui=createMountedInterface(target,initial,{allowedActions:allowed,onError:()=>onError('Rendering failed. Reload to recover.'),onEvent(event){\n    if(disposed || event.revision!==ui.snapshot().revision || event.source!==event.action || !allowed.includes(event.action)) return;\n    try {\n      if(kind==='llm') {\n        if(event.action==='invalid') { try { validateInterfaceDefinition({id:'unsafe',actions:['unapproved'],screen:{key:'bad',component:'Script'}}); } catch { change('error'); } }\n        else if(event.action==='next' && step==='input') { model.scenario=['incident','request','analysis'].includes(event.state.scenario) ? event.state.scenario : 'incident'; change('review'); }\n        else if(event.action==='retry'||event.action==='reset') change('input');\n        else if((event.action==='approve'||event.action==='reject')&&step==='review') { model.message=event.action === 'approve' ? 'Approved in this browser only.' : 'Rejected in this browser only.'; change('done'); }\n      } else if(kind==='operations') {\n        if(event.action==='reset') {ticket++;model.health='healthy';model.job='idle';model.history=['Ready'];model.diagnostic='Scheduler is ready; no infrastructure is connected.';}\n        else if(event.action==='stop') {ticket++;model.health='degraded';model.job='failed';model.diagnostic='Simulated worker timeout. Retry is available.';model.history.push('Job failed: timeout');}\n        else if(event.action==='run'||event.action==='retry') {const id=++ticket;model.job='running';model.history.push('Job started');setTimeout(()=>{if(disposed||ticket!==id)return;model.job='complete';model.health='healthy';model.diagnostic='Simulated job completed.';model.history.push('Job complete');change('input');},500);}\n        model.history=model.history.slice(-20);change('input');\n      } else {\n        if(event.action==='next'&&step==='input') {const title=String(event.state.title||'').trim(),reason=String(event.state.reason||'').trim();if(!title||!reason||title.length>120||reason.length>500){onError('Enter a title and reason within the field limits.');return;}model.form={title,reason};change('review');}\n        else if(event.action==='retry'&&step==='review') change('input');\n        else if((event.action==='approve'||event.action==='reject')&&step==='review') {model.message=`Request ${event.action === 'approve' ? 'approved' : 'rejected'} in this browser only.`;change('done');}\n        else if(event.action==='reset') {model.form={title:'',reason:''};change('input');}\n      }\n    } catch {onError('The candidate interface was rejected. The accepted interface remains available.');}\n  }});\n  return {snapshot:()=>ui.snapshot(),subscribe:listener=>ui.subscribe(listener),dispose(){disposed=true;ticket++;ui.dispose();}};\n}\n", "lab-definition.mjs": "const bind = path => ({ source: 'state', path });\nconst btn = (key, text) => ({ key, component: 'Button', text, action: key });\nconst txt = (key, text) => ({ key, component: 'Text', text });\nconst status = text => ({ key: 'status', component: 'Status', text });\nconst screen = (id, title, children, state = {}) => ({ id, actions: ['next','approve','reject','retry','reset','run','stop','invalid'], state,\n  screen: { key: 'screen', component: 'Stack', children: [{ key: 'heading', component: 'Heading', text: title }, ...children] } });\nconst scenarios = {\n  incident: { title: 'Incident investigation', summary: 'Model suggests investigating elevated error rates.', decision: 'Review evidence and approve an escalation.' },\n  request: { title: 'Request approval', summary: 'Model extracts a proposed access request.', decision: 'Approve or reject the request.' },\n  analysis: { title: 'Operational analysis', summary: 'Model identifies a capacity trend.', decision: 'Accept or reject a follow-up review.' },\n};\nexport function descriptor(kind, step, model) {\n  if (kind === 'llm') {\n    const item = scenarios[model.scenario];\n    if (step === 'input') return screen('llm-input', 'LLM to UI \xB7 simulated output', [txt('explain', 'Choose an authored model response. No model is called.'),\n      { key:'scenario', component:'Select', label:'Scenario', binding:bind('scenario'), options:Object.entries(scenarios).map(([value,v]) => ({value,label:v.title})) }, btn('next','Generate descriptor'), btn('invalid','Try invalid output')], { scenario:model.scenario });\n    if (step === 'done') return screen('llm-done','Local decision recorded',[status(model.message),btn('reset','New scenario')]);\n    if (step === 'error') return screen('llm-error','Output rejected',[status('Invalid descriptor rejected. The last accepted interface is safe.'),btn('retry','Recover')]);\n    return screen('llm-review',item.title,[status('Simulated model output \xB7 validated descriptor'),txt('summary',item.summary),txt('decision',item.decision),btn('approve','Approve locally'),btn('reject','Reject locally'),btn('reset','New scenario')]);\n  }\n  if (kind === 'operations') {\n    const rows = model.history.slice(-6).map((entry,i) => ({ time:String(i+1), event:entry }));\n    return { ...screen('operations','Operations console \xB7 simulation',[status(`Service ${model.health} \xB7 job ${model.job}`),txt('diagnostic',model.diagnostic),{ key:'history',component:'Table',ariaLabel:'Execution history',binding:{source:'data',path:'history'},columns:[{key:'time',label:'#'},{key:'event',label:'Event'}]},btn('run','Run job'),btn('stop','Simulate failure'),btn('retry','Retry job'),btn('reset','Reset simulation')]), data:{history:rows} };\n  }\n  if (step === 'input') return screen('workflow-input','Request \xB7 capture',[txt('help','Enter a title and reason for a simulated request.'),\n    {key:'title',component:'Input',label:'Request title',binding:bind('title'),validation:{required:true}},\n    {key:'reason',component:'Textarea',label:'Reason',binding:bind('reason'),validation:{required:true}},btn('next','Validate and review')],model.form);\n  if (step === 'review') return screen('workflow-review','Review request',[status(`Title: ${model.form.title} \xB7 Reason: ${model.form.reason}`),btn('approve','Approve'),btn('reject','Reject'),btn('retry','Edit request')]);\n  return screen('workflow-done','Request confirmation',[status(model.message),btn('reset','Start another request')]);\n}\n" };

// docs/assets/showcase/lab-shell.mjs
var kind = new URLSearchParams(location.search).get("example");
var names = /* @__PURE__ */ new Map([["llm", "LLM to UI"], ["operations", "Operations Console"], ["workflow", "Adaptive Workflow"]]);
var selected = names.has(kind) ? kind : "llm";
document.querySelector("#title").textContent = names.get(selected);
document.querySelector("#mode").textContent = selected === "llm" ? "Authored, simulated model output" : "Browser-local simulation";
var select = document.querySelector("#source-file");
for (const name2 of Object.keys(sources)) {
  const option = document.createElement("option");
  option.value = name2;
  option.textContent = name2;
  select.append(option);
}
var show = () => document.querySelector("#host-source").textContent = new Map(Object.entries(sources)).get(select.value);
select.addEventListener("change", show);
show();
var tabs = [...document.querySelectorAll('[role="tab"]')];
var panels = [...document.querySelectorAll('[role="tabpanel"]')];
function activate(tab, focus = false) {
  for (const item of tabs) {
    item.setAttribute("aria-selected", String(item === tab));
    item.tabIndex = item === tab ? 0 : -1;
  }
  for (const panel of panels) panel.hidden = panel.id !== tab.getAttribute("aria-controls");
  if (focus) tab.focus();
}
for (const [i, tab] of tabs.entries()) {
  tab.addEventListener("click", () => activate(tab));
  tab.addEventListener("keydown", (e) => {
    const n = { ArrowRight: (i + 1) % 4, ArrowLeft: (i + 3) % 4, Home: 0, End: 3 }[e.key];
    if (n !== void 0) {
      e.preventDefault();
      activate(tabs[n], true);
    }
  });
}
var feedback = document.querySelector("#feedback");
var mounted2;
try {
  mounted2 = mountLab(document.querySelector("#interface"), selected, (message) => feedback.textContent = message);
  const inspect = (s) => {
    document.querySelector("#definition-json").textContent = JSON.stringify(s.definition, null, 2);
    document.querySelector("#snapshot-json").textContent = JSON.stringify({ revision: s.revision, state: s.state, data: s.data }, null, 2);
  };
  inspect(mounted2.snapshot());
  mounted2.subscribe(inspect);
} catch {
  feedback.textContent = "Could not mount the example. Reload to retry.";
}
window.addEventListener("pagehide", () => mounted2?.dispose());
window.addEventListener("pageshow", (e) => {
  if (e.persisted) location.reload();
});
