// ../../../../../tmp/veil-v2-package/package/dist/validation-safety.js
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

// ../../../../../tmp/veil-v2-package/package/dist/interface-transaction.js
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

// ../../../../../tmp/veil-v2-package/package/dist/interface.js
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
  const report2 = (error) => {
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
            report2(error);
          }
          if (revision !== accepted.revision) {
            pending = true;
            break;
          }
        }
        if (++passes >= 32 && pending) {
          report2(new Error("Interface update loop limit exceeded"));
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
          report2(cleanupError);
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
          void Promise.resolve(result).catch(report2);
      } catch (error) {
        report2(error);
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

// ../../../../../tmp/veil-v2-package/package/dist/dom.js
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
  const report2 = (error) => {
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
  const make2 = (tag, className) => {
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
      element = make2("div", `veil-interface-${node.component.toLowerCase()}`);
    else if (node.component === "Text")
      element = make2("p", "veil-interface-text");
    else if (node.component === "Heading")
      element = make2("h2", "veil-interface-heading");
    else if (node.component === "Status") {
      element = make2("p", "veil-interface-status");
      element.setAttribute("role", "status");
      element.setAttribute("aria-live", "polite");
    } else if (node.component === "Button") {
      const button2 = document.createElement("button");
      button2.type = "button";
      button2.className = "veil-interface-button";
      const click = () => {
        if (active && live) {
          try {
            controller.dispatch(node.action, node.key);
          } catch (error) {
            report2(error);
          }
        }
      };
      button2.addEventListener("click", click);
      dispose2 = () => button2.removeEventListener("click", click);
      element = button2;
    } else if (isInterfaceField(node)) {
      const wrapper = make2("div", "veil-interface-input");
      const label = document.createElement("label");
      const input2 = document.createElement(node.component === "Textarea" ? "textarea" : node.component === "Select" ? "select" : "input");
      input2.id = `${domId}-input-${node.key}`;
      label.htmlFor = input2.id;
      if (input2 instanceof HTMLInputElement)
        input2.type = node.inputType ?? "text";
      input2.style.boxSizing = "border-box";
      input2.style.maxWidth = "100%";
      input2.style.minWidth = "0";
      const change = () => {
        if (!active || !live)
          return;
        const value = input2 instanceof HTMLInputElement && input2.type === "checkbox" ? input2.checked : input2.type === "number" && input2.value !== "" ? Number(input2.value) : input2.value;
        try {
          controller.setState(node.binding.path, value);
        } catch (error) {
          const accepted = resolveInterfaceBinding(controller.snapshot(), node.binding);
          if (input2 instanceof HTMLInputElement && input2.type === "checkbox")
            input2.checked = accepted === true;
          else
            input2.value = display(accepted);
          report2(error);
        }
      };
      input2.addEventListener("input", change);
      input2.addEventListener("change", change);
      dispose2 = () => {
        input2.removeEventListener("input", change);
        input2.removeEventListener("change", change);
      };
      const feedback2 = document.createElement("span");
      feedback2.id = `${domId}-feedback-${node.key}`;
      feedback2.setAttribute("aria-live", "polite");
      input2.setAttribute("aria-describedby", feedback2.id);
      wrapper.append(label, input2, feedback2);
      element = wrapper;
    } else if (node.component === "Table") {
      element = make2("table", "veil-interface-table");
      element.style.display = "block";
      element.style.maxWidth = "100%";
      element.style.overflowX = "auto";
    } else if (node.component === "List")
      element = make2("ul", "veil-interface-list");
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
    if (["Text", "Heading", "Status", "Button"].includes(node.component))
      element.textContent = resolveText(node, snapshot);
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
      const input2 = element.querySelector("input,select,textarea");
      if (input2 instanceof HTMLSelectElement) {
        input2.replaceChildren(...[{ value: "", label: "Choose\u2026" }, ...node.options.filter((option) => option.value !== "")].map((option) => {
          const item = document.createElement("option");
          item.value = option.value;
          item.textContent = option.label;
          return item;
        }));
      }
      const errors = getInterfaceValidation(snapshot);
      const error = Object.hasOwn(errors, node.key) ? errors[node.key] : "";
      element.querySelector("span").textContent = error;
      input2.setAttribute("aria-invalid", String(!!error));
      input2.required = node.validation?.required === true;
      label.textContent = node.label ?? "";
      const value = resolveInterfaceBinding(snapshot, node.binding);
      if (input2 instanceof HTMLInputElement && input2.type === "checkbox")
        input2.checked = value === true;
      else {
        const shown = display(value);
        const sameNumber = input2.type === "number" && input2.value !== "" && typeof value === "number" && Number(input2.value) === value;
        if (!sameNumber && input2.value !== shown)
          input2.value = shown;
      }
      if (node.ariaLabel)
        input2.setAttribute("aria-label", node.ariaLabel);
      else
        input2.removeAttribute("aria-label");
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
      report2(error);
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
        report2(error);
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

// docs/assets/playground/source.mjs
var bind = (path) => ({ source: "state", path });
var eq = (path, equals) => ({ binding: bind(path), equals });
var heading = (text) => ({ key: "heading", component: "Heading", text });
var input = (key, label, validation) => ({ key, component: "Input", label, binding: bind(key), validation });
var button = (key, text, extra = {}) => ({ key, component: "Button", text, action: "demo", ...extra });
var make = (id, children, state = {}, data = {}) => ({ id, actions: ["demo"], state, data: { message: "Ready", ...data }, screen: { key: "root", component: "Stack", children: [...children, { key: "status", component: "Status", text: { source: "data", path: "message" } }] } });
var examples = {
  minimal: { description: "Edit a state-bound field and dispatch a host-authorized action.", definition: make("hello", [heading("Hello interface"), input("name", "Your name", {}), button("greet", "Greet")], { name: "" }) },
  form: { description: "Required fields show immediate validation. Submit dispatches only when visible fields are valid.", definition: make("contact", [heading("Contact request"), input("name", "Name", { required: true, minLength: 2, maxLength: 80 }), { key: "kind", component: "Select", label: "Topic", binding: bind("kind"), options: [{ value: "support", label: "Support" }, { value: "sales", label: "Sales" }], validation: { required: true } }, { key: "notes", component: "Textarea", label: "Message", binding: bind("notes"), validation: { required: true, minLength: 10, maxLength: 500 } }, button("send", "Send request", { validate: true })], { name: "", kind: "", notes: "" }) },
  workflow: { description: "Compound conditions control visibility and disabling. Validated progression is handled locally by the host.", definition: make("workflow", [heading("Request review"), input("name", "Your name", { required: true, minLength: 2 }), { key: "kind", component: "Select", label: "Environment", binding: bind("kind"), options: [{ value: "staging", label: "Staging" }, { value: "production", label: "Production" }], validation: { required: true } }, { key: "reason", component: "Textarea", label: "Production reason", binding: bind("reason"), validation: { required: true, minLength: 5 }, visible: { all: [eq("kind", "production"), { not: eq("step", 2) }] } }, { key: "review", component: "Text", text: "Review the request and confirm.", visible: { all: [eq("step", 2), { any: [eq("kind", "staging"), eq("kind", "production")] }] } }, button("next", "Review", { validate: true, visible: eq("step", 1) }), button("confirm", "Confirm", { visible: eq("step", 2), disabled: { not: eq("approved", true) } }), { key: "approved", component: "Input", label: "I reviewed this request", inputType: "checkbox", binding: bind("approved"), visible: eq("step", 2) }], { name: "", kind: "", reason: "", step: 1, approved: false }) },
  dashboard: { description: "Table and list values bind to host data. The action updates only local demonstration data.", definition: make("dashboard", [heading("Service dashboard"), { key: "services", component: "Table", binding: { source: "data", path: "services" }, columns: [{ key: "name", label: "Service" }, { key: "state", label: "Status" }] }, { key: "notes", component: "List", binding: { source: "data", path: "notes" } }, button("refresh", "Refresh locally")], {}, { services: [{ name: "API", state: "Healthy" }, { name: "Jobs", state: "Review" }], notes: ["No external services contacted"] }) },
  ai: { description: "A static example of JSON an AI agent could produce. No model is connected; the host still validates and authorizes it.", definition: make("agent-request", [heading("Access request"), { key: "purpose", component: "Textarea", label: "Business purpose", binding: bind("purpose"), validation: { required: true, minLength: 10, maxLength: 300 } }, { key: "level", component: "Select", label: "Access level", binding: bind("level"), options: [{ value: "read", label: "Read only" }, { value: "write", label: "Write" }], validation: { required: true } }, button("request", "Request access", { validate: true })], { purpose: "", level: "" }) }
};
var editor = document.querySelector("#editor");
var feedback = document.querySelector("#feedback");
var preview = document.querySelector("#preview");
var gallery = document.querySelector("#gallery");
var inspection = document.querySelector("#inspection");
var historyNode = document.querySelector("#history");
var description = document.querySelector("#example-description");
var ui;
var history = [];
function show(value) {
  return JSON.stringify(value, null, 2).slice(0, 16e3);
}
function inspect(snapshot) {
  inspection.textContent = show({ revision: snapshot.revision, state: snapshot.state, data: snapshot.data, validation: getInterfaceValidation(snapshot) });
}
function report(error) {
  const message = String(error?.message || error).slice(0, 500);
  feedback.textContent = message;
  history.unshift({ error: message });
  history = history.slice(0, 20);
  historyNode.textContent = show(history);
}
function parse() {
  if (editor.value.length > 32768 || new TextEncoder().encode(editor.value).length > 32768) throw Error("Definition exceeds 32 KiB.");
  return JSON.parse(editor.value);
}
function render() {
  try {
    const definition = parse();
    if (ui) ui.updateDefinition(definition);
    else {
      ui = createMountedInterface(preview, definition, { allowedActions: ["demo"], onError: report, onEvent(event) {
        try {
          history.unshift({ action: event.action, source: event.source, revision: event.revision });
          history = history.slice(0, 20);
          historyNode.textContent = show(history);
          if (event.source === "next") ui.setState("step", 2);
          else ui.updateData({ ...ui.snapshot().data, message: event.state.name ? `Hello ${event.state.name}. Local action recorded.` : "Local action recorded. No external operation executed." });
        } catch (error) {
          report(error);
        }
      } });
      ui.subscribe(inspect);
    }
    feedback.textContent = "Rendered successfully.";
  } catch (error) {
    report(error);
  }
}
function reset() {
  ui?.dispose();
  ui = void 0;
  history = [];
  historyNode.textContent = "[]";
  description.textContent = examples[gallery.value].description;
  editor.value = JSON.stringify(examples[gallery.value].definition, null, 2);
  render();
}
document.querySelector("#render").onclick = render;
document.querySelector("#reset").onclick = reset;
gallery.onchange = reset;
document.querySelector("#size").onchange = (event) => {
  preview.classList.toggle("mobile", event.target.value === "mobile");
  preview.classList.toggle("narrow", event.target.value === "narrow");
};
document.querySelector("#copy").onclick = async () => {
  try {
    parse();
    await navigator.clipboard.writeText(editor.value);
    feedback.textContent = "Definition copied.";
  } catch (error) {
    report(error);
    feedback.textContent += " Select the editor text to copy manually.";
  }
};
window.addEventListener("pagehide", () => ui?.dispose());
reset();
