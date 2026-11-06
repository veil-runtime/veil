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
        const descriptor = Object.getOwnPropertyDescriptor(item, key);
        if (!descriptor.enumerable || !("value" in descriptor))
          throw new Error("Non-enumerable or accessor data is not supported");
        bytes += key.length * 3;
        visit(descriptor.value, depth + 1);
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
var exact = (value, allowed2) => {
  for (const key of Object.keys(value))
    if (!allowed2.has(key))
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
function validateBindings(definition, data2, state) {
  visitNodes(definition.screen, (node) => {
    if (node.component === "Table") {
      const rows = valueAt(node.binding.source === "data" ? data2 : state, node.binding.path);
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
      const items = valueAt(node.binding.source === "data" ? data2 : state, node.binding.path);
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
  let data2 = copyData(definition.data ?? {});
  let state = copyData(definition.state ?? {});
  validateBindings(current, data2, state);
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
  const snapshot = () => copySnapshot({ definition: current, data: data2, state, revision });
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
      data2 = nextData;
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
      validateBindings(current, data2, next);
      accept(current, data2, next);
    },
    dispatch(action, source) {
      if (disposed || dispatching)
        return;
      if (updating)
        throw new Error("Interface update already in progress");
      if (!current.actions?.includes(action) || !findAction(current.screen, source, action, data2, state))
        throw new Error("Action is not available");
      let submit = false;
      visitNodes(current.screen, (node) => {
        if (node.key === source)
          submit = node.validate === true;
      });
      if (submit && Object.keys(getInterfaceValidation({ definition: current, data: data2, state })).length)
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
function findAction(node, key, action, data2, state) {
  if (node.visible && !evaluateInterfaceCondition(node.visible, { data: data2, state }))
    return false;
  if (node.disabled && evaluateInterfaceCondition(node.disabled, { data: data2, state }))
    return false;
  return node.key === key && node.action === action || (node.children?.some((child) => findAction(child, key, action, data2, state)) ?? false);
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
  let active2 = true;
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
      const button2 = document.createElement("button");
      button2.type = "button";
      button2.className = "veil-interface-button";
      const click = () => {
        if (active2 && live) {
          try {
            controller.dispatch(node.action, node.key);
          } catch (error) {
            report(error);
          }
        }
      };
      button2.addEventListener("click", click);
      dispose2 = () => button2.removeEventListener("click", click);
      element = button2;
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
        if (!active2 || !live)
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
          if (!active2) {
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
    active2 = false;
    throw error;
  }
  const dispose = () => {
    if (!active2)
      return;
    active2 = false;
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

// docs/assets/showcase/agent.mjs
var ACTIONS = Object.freeze(["start", "pause", "advance", "approve", "reject", "cancel", "retry", "probe", "reset"]);
var names = ["Inspect request", "Gather evidence", "Human review", "Prepare handoff"];
var active = /* @__PURE__ */ new Set(["running", "approval"]);
function createAgent({ publish, schedule = (fn) => setTimeout(fn, 1e3), unschedule = clearTimeout }) {
  let generation = 0, ticket = 0, sequence = 0, timer, disposed = false, model;
  function fresh() {
    return {
      phase: "idle",
      paused: false,
      scenario: "failure",
      cursor: 0,
      attempt: 1,
      message: "Ready to investigate a simulated service incident.",
      steps: names.map((name2) => ({ name: name2, status: "Queued", detail: "\u2014" })),
      timeline: [],
      ignored: 0,
      diagnostics: "Host policy ready. No external effects."
    };
  }
  model = fresh();
  function record(event, detail) {
    model.timeline.push({ sequence: String(++sequence).padStart(2, "0"), event, detail });
    model.timeline = model.timeline.slice(-40);
  }
  function stop() {
    ticket++;
    if (timer !== void 0) unschedule(timer);
    timer = void 0;
  }
  function snapshot() {
    return structuredClone(model);
  }
  function emit() {
    if (!disposed) publish(snapshot());
  }
  function queue() {
    stop();
    if (disposed || model.phase !== "running" || model.paused) return;
    const run = generation, expected = ticket;
    timer = schedule(() => {
      if (disposed || run !== generation || expected !== ticket) return;
      timer = void 0;
      advance();
    });
  }
  function advance() {
    if (disposed || model.phase !== "running") return;
    stop();
    switch (model.cursor) {
      case 0:
        model.steps[0] = { name: names[0], status: "Complete", detail: "Incident scope: checkout latency" };
        model.steps[1] = { name: names[1], status: "Running", detail: "metrics.read \xB7 awaiting result" };
        record("tool.result", "inventory.read \u2192 3 services found (simulated)");
        record("tool.started", "metrics.read \xB7 read-only \xB7 attempt 1");
        model.message = "Gathering evidence from simulated metrics.";
        model.cursor = 1;
        break;
      case 1:
        if (model.scenario === "failure" && model.attempt === 1) {
          model.phase = "failed";
          model.steps[1].status = "Failed";
          model.steps[1].detail = "SIM_TIMEOUT \xB7 no result accepted";
          model.message = "Simulated metrics timeout. Retry resumes the failed step.";
          record("tool.failed", "SIM_TIMEOUT \xB7 retry available");
        } else {
          model.steps[1] = { name: names[1], status: "Complete", detail: "p95 latency: 840 ms \xB7 queue: 12" };
          model.steps[2].status = "Awaiting decision";
          model.steps[2].detail = "Approve a simulated handoff; no production action";
          model.phase = "approval";
          model.message = "Your decision is needed. May the simulation prepare a handoff?";
          record("tool.result", "metrics.read \u2192 elevated latency, no service changes");
          record("approval.requested", "Prepare an incident handoff. No real permission is granted.");
          model.cursor = 2;
        }
        break;
      case 2:
        model.steps[3] = { name: names[3], status: "Complete", detail: "Local handoff draft ready \xB7 nothing sent" };
        model.phase = "completed";
        model.message = "Investigation complete. A simulated handoff is ready; nothing was sent.";
        record("tool.result", "handoff.prepare \u2192 local draft with 2 observations");
        record("execution.completed", "All 4 steps complete. No external side effects.");
        model.cursor = 3;
        break;
      default:
        return;
    }
    emit();
    queue();
  }
  function deny() {
    model.ignored++;
    model.diagnostics = "Ignored an invalid, stale or out-of-phase action. Execution unchanged.";
    emit();
    return false;
  }
  function handle(action, state = {}) {
    if (disposed) return false;
    if (!ACTIONS.includes(action)) return deny();
    if (action === "reset") {
      stop();
      generation++;
      sequence = 0;
      model = fresh();
      emit();
      return true;
    }
    if (action === "start") {
      if (active.has(model.phase) || !["failure", "success"].includes(state.scenario)) return deny();
      stop();
      generation++;
      sequence = 0;
      model = fresh();
      model.scenario = state.scenario;
      model.phase = "running";
      model.message = "Inspecting the incident with a simulated read-only tool.";
      model.steps[0] = { name: names[0], status: "Running", detail: "inventory.read \xB7 awaiting result" };
      record("execution.started", `Deterministic ${model.scenario} scenario`);
      record("tool.started", "inventory.read \xB7 read-only");
      emit();
      queue();
      return true;
    }
    if (action === "pause" && model.phase === "running") {
      model.paused = !model.paused;
      record(model.paused ? "execution.paused" : "execution.resumed", "Host scheduler updated");
      emit();
      queue();
      return true;
    }
    if (action === "advance" && model.phase === "running" && model.paused) {
      advance();
      return true;
    }
    if (action === "cancel" && active.has(model.phase)) {
      stop();
      generation++;
      model.phase = "cancelled";
      model.paused = false;
      for (const step of model.steps) if (["Running", "Awaiting decision"].includes(step.status)) step.status = "Cancelled";
      model.message = "Execution cancelled. Pending callbacks cannot update this run.";
      record("execution.cancelled", "Host invalidated the run identity and cleared its timer");
      emit();
      return true;
    }
    if (action === "retry" && model.phase === "failed") {
      stop();
      generation++;
      model.attempt++;
      model.phase = "running";
      model.steps[1].status = "Running";
      model.steps[1].detail = `metrics.read \xB7 attempt ${model.attempt}`;
      model.message = "Retrying the failed tool. The deterministic retry will succeed.";
      record("tool.retried", `metrics.read \xB7 attempt ${model.attempt}`);
      emit();
      queue();
      return true;
    }
    if (["approve", "reject"].includes(action) && model.phase === "approval") {
      const approved = action === "approve";
      model.steps[2].status = approved ? "Complete" : "Rejected";
      model.steps[2].detail = approved ? "Local approval recorded" : "Local rejection recorded";
      record(`approval.${approved ? "approved" : "rejected"}`, "Host checked the current phase before accepting the decision");
      model.phase = approved ? "running" : "rejected";
      model.message = approved ? "Preparing a simulated incident handoff." : "Request rejected. No handoff will be prepared.";
      if (approved) {
        model.steps[3] = { name: names[3], status: "Running", detail: "handoff.prepare \xB7 local simulation" };
        record("tool.started", "handoff.prepare \xB7 local only");
      }
      emit();
      queue();
      return true;
    }
    return deny();
  }
  return {
    handle,
    snapshot,
    diagnostic(message) {
      if (!disposed) {
        model.diagnostics = message;
        emit();
      }
    },
    dispose() {
      disposed = true;
      generation++;
      stop();
    }
  };
}

// docs/assets/showcase/definition.mjs
var data = (path) => ({ source: "data", path });
var allowed = (action) => ({ binding: data(`controls.${action}`), equals: true });
var button = (action, text) => ({ key: action, component: "Button", action, text, disabled: { not: allowed(action) } });
function present(model) {
  const running = model.phase === "running", approval = model.phase === "approval";
  const complete = model.steps.filter((step) => step.status === "Complete").length;
  return {
    status: `${model.phase.toUpperCase()}${model.paused && running ? " \xB7 PAUSED" : ""} \u2014 ${model.message}`,
    progress: `${complete} of 4 steps complete \xB7 ${complete * 25}% \xB7 attempt ${model.attempt}`,
    steps: model.steps,
    timeline: model.timeline,
    diagnostics: model.diagnostics,
    pauseLabel: model.paused ? "Resume" : "Pause",
    controls: {
      start: !running && !approval,
      pause: running,
      advance: running && model.paused,
      approve: approval,
      reject: approval,
      cancel: running || approval,
      retry: model.phase === "failed",
      probe: true,
      reset: true
    }
  };
}
function agentDefinition(model) {
  return {
    id: "agent-monitor",
    actions: [...ACTIONS],
    state: { scenario: "failure" },
    data: present(model),
    screen: { key: "monitor", component: "Stack", children: [
      { key: "overview", component: "Stack", children: [
        { key: "title", component: "Heading", text: "Incident investigator" },
        { key: "progress", component: "Text", text: data("progress") },
        { key: "status", component: "Status", text: data("status") }
      ] },
      { key: "setup", component: "Stack", visible: allowed("start"), children: [
        {
          key: "scenario",
          component: "Select",
          label: "Scenario for the next run",
          binding: { source: "state", path: "scenario" },
          options: [{ value: "failure", label: "Tool timeout \u2192 retry \u2192 approval" }, { value: "success", label: "Successful tools \u2192 approval" }],
          validation: { required: true }
        }
      ] },
      { key: "controls", component: "Row", children: [
        button("start", "Start simulation"),
        button("pause", data("pauseLabel")),
        button("advance", "Advance one step"),
        button("retry", "Retry tool"),
        button("cancel", "Cancel execution")
      ] },
      { key: "approval", component: "Stack", visible: allowed("approve"), children: [
        { key: "approval-title", component: "Heading", text: "A human decision, before the next step." },
        { key: "approval-help", component: "Text", text: "Review the evidence below. This decision only controls the local simulation; it grants no production permission." },
        { key: "decisions", component: "Row", children: [button("approve", "Approve handoff"), button("reject", "Reject request")] }
      ] },
      { key: "steps-title", component: "Heading", text: "Execution steps" },
      { key: "steps", component: "Table", ariaLabel: "Execution steps", binding: data("steps"), columns: [
        { key: "name", label: "Step" },
        { key: "status", label: "Status" },
        { key: "detail", label: "Tool / result" }
      ] },
      { key: "timeline-title", component: "Heading", text: "Event timeline" },
      { key: "timeline", component: "Table", ariaLabel: "Event timeline", binding: data("timeline"), columns: [
        { key: "sequence", label: "#" },
        { key: "event", label: "Agent event" },
        { key: "detail", label: "Host observation" }
      ] },
      { key: "diagnostics-title", component: "Heading", text: "Integration diagnostics" },
      { key: "diagnostics", component: "Status", text: data("diagnostics") },
      { key: "utilities", component: "Row", children: [button("probe", "Test update safeguards"), button("reset", "Reset simulation")] }
    ] }
  };
}

// docs/assets/showcase/integration.mjs
function mountAgent(target, { onError = () => {
}, schedule, unschedule } = {}) {
  let ui, disposed = false;
  const agent = createAgent({ schedule, unschedule, publish(model) {
    if (disposed) return;
    try {
      const expected = ui.snapshot().revision;
      if (!ui.updateData(present(model), expected)) onError("An outdated display update was ignored.");
    } catch {
      agent.dispose();
      onError("The display could not be updated. Reload to restart safely.");
    }
  } });
  const definition = agentDefinition(agent.snapshot());
  if (new TextEncoder().encode(JSON.stringify(definition)).length > 32768) throw Error("Descriptor exceeds 32 KiB");
  validateInterfaceDefinition(definition);
  try {
    ui = createMountedInterface(target, definition, {
      allowedActions: ACTIONS,
      onError() {
        agent.dispose();
        onError("The display could not be updated. Reload to restart safely.");
      },
      onEvent(event) {
        if (disposed || event.revision !== ui.snapshot().revision || event.source !== event.action || !ACTIONS.includes(event.action)) return;
        if (event.action === "probe") {
          const staleRejected = ui.updateData({ ...ui.snapshot().data, status: "STALE" }, event.revision - 1) === false;
          let invalidRejected = false;
          try {
            ui.updateData({ ...ui.snapshot().data, steps: "invalid table data" });
          } catch {
            invalidRejected = true;
          }
          agent.diagnostic(staleRejected && invalidRejected ? "Rejected a stale revision and invalid table data. The accepted interface was preserved." : "A safeguard probe failed. Reload and inspect the integration.");
          return;
        }
        agent.handle(event.action, event.state);
        if (event.action === "reset") ui.setState("scenario", "failure");
      }
    });
  } catch (error) {
    agent.dispose();
    throw error;
  }
  return {
    snapshot: () => ui.snapshot(),
    subscribe: (listener) => ui.subscribe(listener),
    dispose() {
      disposed = true;
      agent.dispose();
      ui.dispose();
    }
  };
}

// docs/assets/showcase/backend.mjs
var seed = [
  { id: "INC-104", title: "Checkout latency", status: "Investigating" },
  { id: "INC-103", title: "Queue backlog", status: "Monitoring" },
  { id: "INC-102", title: "Cache refresh", status: "Resolved" }
];
var BACKEND_ACTIONS = Object.freeze(["load", "search", "submit", "retry", "cancel", "reset"]);
function backendDefinition(data2) {
  return {
    id: "backend-lab",
    actions: [...BACKEND_ACTIONS],
    state: { query: "", title: "", detail: "" },
    data: data2,
    screen: { key: "root", component: "Stack", children: [
      { key: "heading", component: "Heading", text: "Incident records" },
      { key: "status", component: "Status", text: { source: "data", path: "message" } },
      { key: "error", component: "Text", text: { source: "data", path: "error" } },
      { key: "query", component: "Input", label: "Filter records", binding: { source: "state", path: "query" }, validation: { maxLength: 80 } },
      { key: "search", component: "Button", text: "Search", action: "search" },
      { key: "retry", component: "Button", text: "Retry loading", action: "retry" },
      { key: "cancel", component: "Button", text: "Cancel request", action: "cancel" },
      { key: "reset", component: "Button", text: "Reload records", action: "reset" },
      { key: "records", component: "Table", binding: { source: "data", path: "records" }, columns: [{ key: "id", label: "ID" }, { key: "title", label: "Record" }, { key: "status", label: "Status" }] },
      { key: "title", component: "Input", label: "New incident title", binding: { source: "state", path: "title" }, validation: { required: true, minLength: 4, maxLength: 80 } },
      { key: "detail", component: "Textarea", label: "Describe the incident", binding: { source: "state", path: "detail" }, validation: { required: true, minLength: 8, maxLength: 500 } },
      { key: "submit", component: "Button", text: "Submit incident", action: "submit", validate: true }
    ] }
  };
}
function simulatedAdapter() {
  let records = structuredClone(seed);
  return { async list(q, signal) {
    await new Promise((resolve, reject) => {
      const id = setTimeout(resolve, 350);
      signal.addEventListener("abort", () => {
        clearTimeout(id);
        reject(new DOMException("Aborted", "AbortError"));
      }, { once: true });
    });
    return records.filter((row) => `${row.id} ${row.title} ${row.status}`.toLowerCase().includes(q.toLowerCase()));
  }, async create(input, signal) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    if (input.title.length < 4 || input.detail.length < 8) throw Object.assign(Error("Server validation: title or detail is too short."), { status: 422 });
    const row = { id: `SIM-${records.length + 1}`, title: input.title, status: "Submitted (simulation)" };
    records.unshift(row);
    return row;
  } };
}

// docs/assets/showcase/backend-integration.mjs
function mountBackend(target, { onError = () => {
}, mode = "simulation", base = "", fetchImpl = fetch, trace = () => {
} } = {}) {
  const adapter = mode === "http" ? {
    async session(signal) {
      const r = await fetchImpl(`${base}/api/session`, { method: "POST", credentials: "same-origin", signal });
      if (!r.ok) throw Error("Could not open demo session.");
    },
    async list(q, signal) {
      const r = await fetchImpl(`${base}/api/records?q=${encodeURIComponent(q)}`, { credentials: "same-origin", signal });
      if (!r.ok) throw Error("Records could not be loaded. Retry the request.");
      return (await r.json()).records;
    },
    async create(body, signal) {
      const r = await fetchImpl(`${base}/api/records`, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
      const result = await r.json();
      if (!r.ok) throw Object.assign(Error(result.error || "Request rejected."), { status: r.status });
      return result.record;
    }
  } : simulatedAdapter();
  let ui, active2, serial = 0, disposed = false;
  const commit = (data3, revision) => {
    if (!disposed && revision === ui.snapshot().revision) return ui.updateData(data3, revision);
    trace("update.rejected", { disposed, expected: revision, actual: ui?.snapshot().revision });
    return false;
  };
  async function request(kind, query = "") {
    trace("request.start", { kind, query, nextId: serial + 1, revision: ui.snapshot().revision });
    active2?.abort();
    const controller = new AbortController();
    active2 = controller;
    const id = ++serial, revision = ui.snapshot().revision;
    const prior = ui.snapshot().data;
    commit({ ...prior, loading: true, error: "", message: `${kind === "submit" ? "Submitting" : "Loading"}\u2026` }, revision);
    const acceptedRevision = ui.snapshot().revision;
    try {
      if (kind === "submit") await adapter.create({ title: ui.snapshot().state.title.trim(), detail: ui.snapshot().state.detail.trim() }, controller.signal);
      const records = await adapter.list(query, controller.signal);
      trace("request.response", { id, activeId: serial, disposed, aborted: controller.signal.aborted, count: records.length });
      if (disposed || controller.signal.aborted || id !== serial) {
        trace("request.ignored", { id, activeId: serial });
        return;
      }
      const accepted = commit({ ...ui.snapshot().data, loading: false, error: "", records, message: kind === "submit" ? `Submitted successfully. ${mode === "http" ? "The refreshed records came from the service." : "Browser-local simulation only; nothing was sent."}` : `${records.length} records loaded.` }, ui.snapshot().revision);
      trace("request.applied", { id, accepted, revision: ui.snapshot().revision });
    } catch (error) {
      trace("request.error", { id, name: error.name, status: error.status, activeId: serial, disposed, aborted: controller.signal.aborted });
      if (disposed || controller.signal.aborted || id !== serial) return;
      commit({ ...ui.snapshot().data, loading: false, error: String(error.status === 422 ? error.message : "Request failed. Check the connection and retry."), message: "Request failed." }, ui.snapshot().revision);
      onError("The service rejected or could not complete the request. Details are shown safely in the interface.");
    }
    if (id === serial) active2 = void 0;
  }
  const data2 = { message: "Ready. Select Search to load records.", error: "", loading: false, records: [] };
  const definition = backendDefinition(data2);
  if (new TextEncoder().encode(JSON.stringify(definition)).length > 32768) throw Error("Descriptor too large");
  validateInterfaceDefinition(definition);
  ui = createMountedInterface(target, definition, { allowedActions: BACKEND_ACTIONS, onError: () => onError("Interface update failed."), onEvent(event) {
    trace("ui.action", { action: event.action, source: event.source, revision: event.revision, currentRevision: ui.snapshot().revision, state: event.state });
    if (disposed || event.revision !== ui.snapshot().revision || event.source !== event.action || !BACKEND_ACTIONS.includes(event.action)) {
      trace("ui.action.rejected");
      return;
    }
    if (event.action === "cancel") {
      serial++;
      active2?.abort();
      active2 = void 0;
      ui.updateData({ ...ui.snapshot().data, loading: false, message: "Request cancelled." }, event.revision);
    } else if (event.action === "reset") {
      serial++;
      active2?.abort();
      active2 = void 0;
      ui.setState("query", "");
      ui.setState("title", "");
      ui.setState("detail", "");
      void request("load");
    } else if (event.action === "search" || event.action === "retry") {
      const query = String(event.state.query || "").slice(0, 80);
      trace("search.dispatch", { query, revision: event.revision });
      void request("load", query);
    } else if (event.action === "submit") void request("submit");
  } });
  if (mode === "http") void adapter.session(new AbortController().signal).then(() => request("load")).catch(() => onError("Local demo service unavailable. Start the service and retry."));
  return { snapshot: () => ui.snapshot(), subscribe: (fn) => ui.subscribe(fn), dispose() {
    disposed = true;
    serial++;
    active2?.abort();
    ui.dispose();
  } };
}

// showcase:sources
var sources = { "integration.mjs": "import { createMountedInterface } from '@veil-runtime/ui/dom';\nimport { validateInterfaceDefinition } from '@veil-runtime/ui/interface';\nimport { ACTIONS, createAgent } from './agent.mjs';\nimport { agentDefinition, present } from './definition.mjs';\n\n// This is the actual integration used by the showcase, not a parallel snippet.\nexport function mountAgent(target, { onError = () => {}, schedule, unschedule } = {}) {\n  let ui, disposed = false;\n  const agent = createAgent({ schedule, unschedule, publish(model) {\n    if (disposed) return;\n    try {\n      const expected = ui.snapshot().revision;\n      if (!ui.updateData(present(model), expected)) onError('An outdated display update was ignored.');\n    } catch {\n      agent.dispose();\n      onError('The display could not be updated. Reload to restart safely.');\n    }\n  } });\n  const definition = agentDefinition(agent.snapshot());\n  if (new TextEncoder().encode(JSON.stringify(definition)).length > 32768) throw Error('Descriptor exceeds 32 KiB');\n  validateInterfaceDefinition(definition);\n  try {\n    ui = createMountedInterface(target, definition, { allowedActions: ACTIONS,\n      onError() { agent.dispose(); onError('The display could not be updated. Reload to restart safely.'); },\n      onEvent(event) {\n        // UI declaration/allowlist checks complement, but do not replace, host policy.\n        if (disposed || event.revision !== ui.snapshot().revision || event.source !== event.action || !ACTIONS.includes(event.action)) return;\n        if (event.action === 'probe') {\n          const staleRejected = ui.updateData({ ...ui.snapshot().data, status: 'STALE' }, event.revision - 1) === false;\n          let invalidRejected = false;\n          try { ui.updateData({ ...ui.snapshot().data, steps: 'invalid table data' }); }\n          catch { invalidRejected = true; }\n          agent.diagnostic(staleRejected && invalidRejected\n            ? 'Rejected a stale revision and invalid table data. The accepted interface was preserved.'\n            : 'A safeguard probe failed. Reload and inspect the integration.');\n          return;\n        }\n        agent.handle(event.action, event.state);\n        if (event.action === 'reset') ui.setState('scenario', 'failure');\n      },\n    });\n  } catch (error) { agent.dispose(); throw error; }\n  return { snapshot: () => ui.snapshot(), subscribe: listener => ui.subscribe(listener),\n    dispose() { disposed = true; agent.dispose(); ui.dispose(); } };\n}\n", "agent.mjs": "// Host-owned deterministic simulation. No agent framework or service is connected.\nexport const ACTIONS = Object.freeze(['start', 'pause', 'advance', 'approve', 'reject', 'cancel', 'retry', 'probe', 'reset']);\nconst names = ['Inspect request', 'Gather evidence', 'Human review', 'Prepare handoff'];\nconst active = new Set(['running', 'approval']);\n\nexport function createAgent({ publish, schedule = fn => setTimeout(fn, 1000), unschedule = clearTimeout }) {\n  let generation = 0, ticket = 0, sequence = 0, timer, disposed = false, model;\n  function fresh() {\n    return { phase: 'idle', paused: false, scenario: 'failure', cursor: 0, attempt: 1,\n      message: 'Ready to investigate a simulated service incident.',\n      steps: names.map(name => ({ name, status: 'Queued', detail: '\u2014' })),\n      timeline: [], ignored: 0, diagnostics: 'Host policy ready. No external effects.' };\n  }\n  model = fresh();\n  function record(event, detail) {\n    model.timeline.push({ sequence: String(++sequence).padStart(2, '0'), event, detail });\n    model.timeline = model.timeline.slice(-40);\n  }\n  function stop() { ticket++; if (timer !== undefined) unschedule(timer); timer = undefined; }\n  function snapshot() { return structuredClone(model); }\n  function emit() { if (!disposed) publish(snapshot()); }\n  function queue() {\n    stop();\n    if (disposed || model.phase !== 'running' || model.paused) return;\n    const run = generation, expected = ticket;\n    timer = schedule(() => {\n      // Both execution identity and pending-work identity must still match.\n      if (disposed || run !== generation || expected !== ticket) return;\n      timer = undefined;\n      advance();\n    });\n  }\n  function advance() {\n    if (disposed || model.phase !== 'running') return;\n    stop();\n    switch (model.cursor) {\n      case 0:\n        model.steps[0] = { name: names[0], status: 'Complete', detail: 'Incident scope: checkout latency' };\n        model.steps[1] = { name: names[1], status: 'Running', detail: 'metrics.read \xB7 awaiting result' };\n        record('tool.result', 'inventory.read \u2192 3 services found (simulated)');\n        record('tool.started', 'metrics.read \xB7 read-only \xB7 attempt 1');\n        model.message = 'Gathering evidence from simulated metrics.';\n        model.cursor = 1;\n        break;\n      case 1:\n        if (model.scenario === 'failure' && model.attempt === 1) {\n          model.phase = 'failed';\n          model.steps[1].status = 'Failed';\n          model.steps[1].detail = 'SIM_TIMEOUT \xB7 no result accepted';\n          model.message = 'Simulated metrics timeout. Retry resumes the failed step.';\n          record('tool.failed', 'SIM_TIMEOUT \xB7 retry available');\n        } else {\n          model.steps[1] = { name: names[1], status: 'Complete', detail: 'p95 latency: 840 ms \xB7 queue: 12' };\n          model.steps[2].status = 'Awaiting decision';\n          model.steps[2].detail = 'Approve a simulated handoff; no production action';\n          model.phase = 'approval';\n          model.message = 'Your decision is needed. May the simulation prepare a handoff?';\n          record('tool.result', 'metrics.read \u2192 elevated latency, no service changes');\n          record('approval.requested', 'Prepare an incident handoff. No real permission is granted.');\n          model.cursor = 2;\n        }\n        break;\n      case 2:\n        model.steps[3] = { name: names[3], status: 'Complete', detail: 'Local handoff draft ready \xB7 nothing sent' };\n        model.phase = 'completed';\n        model.message = 'Investigation complete. A simulated handoff is ready; nothing was sent.';\n        record('tool.result', 'handoff.prepare \u2192 local draft with 2 observations');\n        record('execution.completed', 'All 4 steps complete. No external side effects.');\n        model.cursor = 3;\n        break;\n      default: return;\n    }\n    emit(); queue();\n  }\n  function deny() {\n    model.ignored++;\n    model.diagnostics = 'Ignored an invalid, stale or out-of-phase action. Execution unchanged.';\n    emit(); return false;\n  }\n  function handle(action, state = {}) {\n    if (disposed) return false;\n    if (!ACTIONS.includes(action)) return deny();\n    if (action === 'reset') {\n      stop(); generation++; sequence = 0; model = fresh(); emit(); return true;\n    }\n    if (action === 'start') {\n      if (active.has(model.phase) || !['failure', 'success'].includes(state.scenario)) return deny();\n      stop(); generation++; sequence = 0; model = fresh(); model.scenario = state.scenario;\n      model.phase = 'running'; model.message = 'Inspecting the incident with a simulated read-only tool.';\n      model.steps[0] = { name: names[0], status: 'Running', detail: 'inventory.read \xB7 awaiting result' };\n      record('execution.started', `Deterministic ${model.scenario} scenario`);\n      record('tool.started', 'inventory.read \xB7 read-only');\n      emit(); queue(); return true;\n    }\n    if (action === 'pause' && model.phase === 'running') {\n      model.paused = !model.paused;\n      record(model.paused ? 'execution.paused' : 'execution.resumed', 'Host scheduler updated');\n      emit(); queue(); return true;\n    }\n    if (action === 'advance' && model.phase === 'running' && model.paused) { advance(); return true; }\n    if (action === 'cancel' && active.has(model.phase)) {\n      stop(); generation++; model.phase = 'cancelled'; model.paused = false;\n      for (const step of model.steps) if (['Running', 'Awaiting decision'].includes(step.status)) step.status = 'Cancelled';\n      model.message = 'Execution cancelled. Pending callbacks cannot update this run.';\n      record('execution.cancelled', 'Host invalidated the run identity and cleared its timer');\n      emit(); return true;\n    }\n    if (action === 'retry' && model.phase === 'failed') {\n      stop(); generation++; model.attempt++; model.phase = 'running';\n      model.steps[1].status = 'Running'; model.steps[1].detail = `metrics.read \xB7 attempt ${model.attempt}`;\n      model.message = 'Retrying the failed tool. The deterministic retry will succeed.';\n      record('tool.retried', `metrics.read \xB7 attempt ${model.attempt}`);\n      emit(); queue(); return true;\n    }\n    if (['approve', 'reject'].includes(action) && model.phase === 'approval') {\n      const approved = action === 'approve';\n      model.steps[2].status = approved ? 'Complete' : 'Rejected';\n      model.steps[2].detail = approved ? 'Local approval recorded' : 'Local rejection recorded';\n      record(`approval.${approved ? 'approved' : 'rejected'}`, 'Host checked the current phase before accepting the decision');\n      model.phase = approved ? 'running' : 'rejected';\n      model.message = approved ? 'Preparing a simulated incident handoff.' : 'Request rejected. No handoff will be prepared.';\n      if (approved) {\n        model.steps[3] = { name: names[3], status: 'Running', detail: 'handoff.prepare \xB7 local simulation' };\n        record('tool.started', 'handoff.prepare \xB7 local only');\n      }\n      emit(); queue(); return true;\n    }\n    return deny();\n  }\n  return { handle, snapshot, diagnostic(message) { if (!disposed) { model.diagnostics = message; emit(); } },\n    dispose() { disposed = true; generation++; stop(); } };\n}\n", "definition.mjs": "import { ACTIONS } from './agent.mjs';\nconst data = path => ({ source: 'data', path });\nconst allowed = action => ({ binding: data(`controls.${action}`), equals: true });\nconst button = (action, text) => ({ key: action, component: 'Button', action, text, disabled: { not: allowed(action) } });\n\nexport function present(model) {\n  const running = model.phase === 'running', approval = model.phase === 'approval';\n  const complete = model.steps.filter(step => step.status === 'Complete').length;\n  return {\n    status: `${model.phase.toUpperCase()}${model.paused && running ? ' \xB7 PAUSED' : ''} \u2014 ${model.message}`,\n    progress: `${complete} of 4 steps complete \xB7 ${complete * 25}% \xB7 attempt ${model.attempt}`,\n    steps: model.steps, timeline: model.timeline, diagnostics: model.diagnostics,\n    pauseLabel: model.paused ? 'Resume' : 'Pause',\n    controls: { start: !running && !approval, pause: running, advance: running && model.paused,\n      approve: approval, reject: approval, cancel: running || approval, retry: model.phase === 'failed', probe: true, reset: true },\n  };\n}\n\nexport function agentDefinition(model) {\n  return { id: 'agent-monitor', actions: [...ACTIONS], state: { scenario: 'failure' }, data: present(model),\n    screen: { key: 'monitor', component: 'Stack', children: [\n      { key: 'overview', component: 'Stack', children: [\n        { key: 'title', component: 'Heading', text: 'Incident investigator' },\n        { key: 'progress', component: 'Text', text: data('progress') },\n        { key: 'status', component: 'Status', text: data('status') },\n      ] },\n      { key: 'setup', component: 'Stack', visible: allowed('start'), children: [\n        { key: 'scenario', component: 'Select', label: 'Scenario for the next run', binding: { source: 'state', path: 'scenario' },\n          options: [{ value: 'failure', label: 'Tool timeout \u2192 retry \u2192 approval' }, { value: 'success', label: 'Successful tools \u2192 approval' }], validation: { required: true } },\n      ] },\n      { key: 'controls', component: 'Row', children: [\n        button('start', 'Start simulation'), button('pause', data('pauseLabel')), button('advance', 'Advance one step'),\n        button('retry', 'Retry tool'), button('cancel', 'Cancel execution'),\n      ] },\n      { key: 'approval', component: 'Stack', visible: allowed('approve'), children: [\n        { key: 'approval-title', component: 'Heading', text: 'A human decision, before the next step.' },\n        { key: 'approval-help', component: 'Text', text: 'Review the evidence below. This decision only controls the local simulation; it grants no production permission.' },\n        { key: 'decisions', component: 'Row', children: [button('approve', 'Approve handoff'), button('reject', 'Reject request')] },\n      ] },\n      { key: 'steps-title', component: 'Heading', text: 'Execution steps' },\n      { key: 'steps', component: 'Table', ariaLabel: 'Execution steps', binding: data('steps'), columns: [\n        { key: 'name', label: 'Step' }, { key: 'status', label: 'Status' }, { key: 'detail', label: 'Tool / result' },\n      ] },\n      { key: 'timeline-title', component: 'Heading', text: 'Event timeline' },\n      { key: 'timeline', component: 'Table', ariaLabel: 'Event timeline', binding: data('timeline'), columns: [\n        { key: 'sequence', label: '#' }, { key: 'event', label: 'Agent event' }, { key: 'detail', label: 'Host observation' },\n      ] },\n      { key: 'diagnostics-title', component: 'Heading', text: 'Integration diagnostics' },\n      { key: 'diagnostics', component: 'Status', text: data('diagnostics') },\n      { key: 'utilities', component: 'Row', children: [button('probe', 'Test update safeguards'), button('reset', 'Reset simulation')] },\n    ] } };\n}\n" };

// docs/assets/showcase/shell.mjs
var tabs = [...document.querySelectorAll('[role="tab"]')];
var panels = [...document.querySelectorAll('[role="tabpanel"]')];
function select(tab, focus = false) {
  for (const item of tabs) {
    item.setAttribute("aria-selected", String(item === tab));
    item.tabIndex = item === tab ? 0 : -1;
  }
  for (const panel of panels) panel.hidden = panel.id !== tab.getAttribute("aria-controls");
  if (focus) tab.focus();
}
for (const [index, tab] of tabs.entries()) {
  tab.addEventListener("click", () => select(tab));
  tab.addEventListener("keydown", (event) => {
    const target = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
    if (target !== void 0) {
      event.preventDefault();
      select(tabs[target], true);
    }
  });
}
var feedback = document.querySelector("#feedback");
var sourceSelect = document.querySelector("#source-file");
var sourceFiles = new Map(Object.entries(sources));
for (const name2 of sourceFiles.keys()) {
  const option = document.createElement("option");
  option.value = name2;
  option.textContent = name2;
  sourceSelect.append(option);
}
function showSource() {
  document.querySelector("#host-source").textContent = sourceFiles.get(sourceSelect.value) ?? "Source unavailable.";
}
sourceSelect.addEventListener("change", showSource);
showSource();
var mounted2;
function inspect(snapshot) {
  document.querySelector("#definition-json").textContent = JSON.stringify(snapshot.definition, null, 2);
  document.querySelector("#snapshot-json").textContent = JSON.stringify({ revision: snapshot.revision, state: snapshot.state, data: snapshot.data }, null, 2);
  document.querySelector("#revision").textContent = `UI revision ${snapshot.revision}`;
}
try {
  const target = document.querySelector("#agent-interface");
  mounted2 = target ? mountAgent(target, { onError(message) {
    feedback.textContent = message;
  } }) : mountBackend(document.querySelector("#backend-interface"), { mode: document.body.dataset.mode, base: document.body.dataset.api || "", onError(message) {
    feedback.textContent = message;
  } });
  inspect(mounted2.snapshot());
  mounted2.subscribe(inspect);
} catch {
  feedback.textContent = "The simulation could not load. Reload the page to try again.";
}
document.querySelector("#export").addEventListener("click", () => {
  if (!mounted2) return;
  const snapshot = mounted2.snapshot();
  const output = { ...snapshot.definition, data: snapshot.data, state: snapshot.state };
  const url = URL.createObjectURL(new Blob([JSON.stringify(output, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "agent-interface.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
  feedback.textContent = "Exported the definition with current data and state. Host code is still required to run actions.";
});
window.addEventListener("pagehide", () => mounted2?.dispose());
window.addEventListener("pageshow", (event) => {
  if (event.persisted) window.location.reload();
});
