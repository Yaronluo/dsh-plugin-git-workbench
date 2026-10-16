export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array'
  required?: boolean
  description?: string
  items?: { type: string }
  enum?: readonly string[]
  default?: unknown
}

export interface ToolOutput {
  schema: Record<string, unknown>
  render?: (args: any, value: any) => unknown
}

export interface ToolDefinition {
  name: string
  description: string
  parameters?: Record<string, ToolParameter>
  output: ToolOutput
  execute: (args: any, exec: any) => Promise<unknown>
  timeoutMs?: number
  isConcurrencySafe?: boolean
}

type SchemaRecord = Record<string, any>

const annotationKeys = ['description', 'title', 'default', 'examples'] as const
const schemaTypes = new Set(['string', 'number', 'integer', 'boolean', 'null', 'array', 'object', 'json'])
const scalarTypes = new Set(['string', 'number', 'integer', 'boolean', 'null'])

function isRecord(value: unknown): value is SchemaRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function copyAnnotations(source: SchemaRecord, target: SchemaRecord): void {
  for (const key of annotationKeys) {
    if (Object.hasOwn(source, key)) target[key] = source[key]
  }
}

function assertOnlyKeys(source: SchemaRecord, allowed: readonly string[], path: string): void {
  for (const key of Object.keys(source)) {
    if (!allowed.includes(key)) throw new Error(`${path}.${key} is not supported by the tool schema`)
  }
}

function compileValueSchema(source: unknown, path: string, allowRequired: boolean, ancestors: Set<object>): SchemaRecord {
  if (!isRecord(source)) throw new Error(`${path} must be a schema object`)
  if (ancestors.has(source)) throw new Error(`${path} is circular`)
  ancestors.add(source)

  try {
    const allowedBase = [...annotationKeys, ...(allowRequired ? ['required'] : [])]
    if (Object.hasOwn(source, 'required') && source.required !== true) {
      throw new Error(`${path}.required must be true when present`)
    }

    if (Object.hasOwn(source, 'oneOf')) {
      assertOnlyKeys(source, [...allowedBase, 'oneOf'], path)
      if (!Array.isArray(source.oneOf) || source.oneOf.length < 2) {
        throw new Error(`${path}.oneOf must contain at least two schemas`)
      }
      const result: SchemaRecord = { oneOf: source.oneOf.map((branch: unknown, index: number) => compileValueSchema(branch, `${path}.oneOf[${index}]`, false, ancestors)) }
      copyAnnotations(source, result)
      return result
    }

    const type = source.type
    if (!schemaTypes.has(type)) throw new Error(`${path}.type must be a supported JSON schema type`)
    const result: SchemaRecord = {}

    if (type === 'json') {
      assertOnlyKeys(source, [...allowedBase, 'type'], path)
      copyAnnotations(source, result)
      return result
    }

    if (type === 'object') {
      assertOnlyKeys(source, [...allowedBase, 'type', 'properties', 'additionalProperties'], path)
      if (typeof source.additionalProperties !== 'boolean') {
        throw new Error(`${path}.additionalProperties must be explicitly true or false`)
      }
      result.type = 'object'
      result.additionalProperties = source.additionalProperties
      copyAnnotations(source, result)
      if (Object.hasOwn(source, 'properties')) {
        if (!isRecord(source.properties)) throw new Error(`${path}.properties must be an object`)
        const properties: SchemaRecord = {}
        const required: string[] = []
        for (const [key, child] of Object.entries(source.properties)) {
          if (!isRecord(child)) throw new Error(`${path}.properties.${key} must be a schema object`)
          if (Object.hasOwn(child, 'required') && child.required === true) required.push(key)
          properties[key] = compileValueSchema(child, `${path}.properties.${key}`, true, ancestors)
        }
        result.properties = properties
        if (required.length > 0) result.required = required
      }
      return result
    }

    if (type === 'array') {
      assertOnlyKeys(source, [...allowedBase, 'type', 'items'], path)
      result.type = 'array'
      copyAnnotations(source, result)
      if (Object.hasOwn(source, 'items')) result.items = compileValueSchema(source.items, `${path}.items`, false, ancestors)
      return result
    }

    assertOnlyKeys(source, [...allowedBase, 'type', 'enum', 'const'], path)
    if (!scalarTypes.has(type)) throw new Error(`${path}.type must be a supported scalar schema type`)
    result.type = type
    copyAnnotations(source, result)
    if (Object.hasOwn(source, 'enum')) {
      if (!Array.isArray(source.enum) || source.enum.length === 0 || source.enum.some((item: unknown) => item !== null && !['string', 'number', 'boolean'].includes(typeof item))) {
        throw new Error(`${path}.enum must be a non-empty array of scalar values`)
      }
      result.enum = [...source.enum]
    }
    if (Object.hasOwn(source, 'const')) result.const = source.const
    return result
  } finally {
    ancestors.delete(source)
  }
}

function compileParameters(parameters: Record<string, ToolParameter> | undefined): SchemaRecord {
  const source = parameters ?? {}
  if (!isRecord(source)) throw new Error('parameters must be an object')
  const properties: SchemaRecord = {}
  const required: string[] = []

  for (const [name, parameter] of Object.entries(source)) {
    if (!isRecord(parameter)) throw new Error(`parameters.${name} must be an object`)
    if (!['string', 'number', 'boolean', 'array'].includes(parameter.type)) {
      throw new Error(`parameters.${name}.type must be string, number, boolean, or array`)
    }
    if (parameter.required !== undefined && typeof parameter.required !== 'boolean') {
      throw new Error(`parameters.${name}.required must be a boolean`)
    }
    if (parameter.description !== undefined && typeof parameter.description !== 'string') {
      throw new Error(`parameters.${name}.description must be a string`)
    }
    const prop: SchemaRecord = { type: parameter.type }
    if (parameter.description !== undefined) prop.description = parameter.description
    if (parameter.default !== undefined) prop.default = parameter.default
    if (parameter.enum !== undefined) {
      if (!Array.isArray(parameter.enum) || parameter.enum.some((value: unknown) => typeof value !== 'string')) {
        throw new Error(`parameters.${name}.enum must be an array of strings`)
      }
      prop.enum = [...parameter.enum]
    }
    if (parameter.type === 'array' && parameter.items !== undefined) {
      if (!isRecord(parameter.items) || typeof parameter.items.type !== 'string') {
        throw new Error(`parameters.${name}.items must declare a type`)
      }
      prop.items = { type: parameter.items.type }
    } else if (parameter.type !== 'array' && parameter.items !== undefined) {
      throw new Error(`parameters.${name}.items is only supported for arrays`)
    }
    properties[name] = prop
    if (parameter.required === true) required.push(name)
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  }
}

/**
 * Mirrors `defineTool` in `@deepseek-ai/dsh-tools/lib/types/schema.js:274-321`.
 * Keep this in sync when DSH changes. This shim normalizes parameter and output
 * schemas and validates their authoring shape, but deliberately does not reproduce
 * upstream argument/output value validation or its schema-library diagnostics;
 * execute and render callbacks remain the original function references.
 */
export function defineTool<T extends ToolDefinition>(definition: T): T {
  if (!isRecord(definition)) throw new Error('defineTool: definition must be an object')
  if (typeof definition.name !== 'string' || !/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(definition.name)) {
    throw new Error('defineTool: name must be snake_case')
  }
  if (typeof definition.description !== 'string' || !definition.description.trim()) {
    throw new Error(`defineTool(${definition.name}): description is required`)
  }
  if (typeof definition.execute !== 'function') {
    throw new Error(`defineTool(${definition.name}): execute must be a function`)
  }
  if (!isRecord(definition.output) || !isRecord(definition.output.schema)) {
    throw new Error(`defineTool(${definition.name}): output.schema is required and must be an object`)
  }
  if (definition.output.render !== undefined && typeof definition.output.render !== 'function') {
    throw new Error(`defineTool(${definition.name}): output.render must be a function`)
  }
  if (definition.timeoutMs !== undefined && (!Number.isFinite(definition.timeoutMs) || definition.timeoutMs <= 0)) {
    throw new Error(`defineTool(${definition.name}): timeoutMs must be a positive finite number`)
  }

  const parameters = compileParameters(definition.parameters)
  const outputSchema = compileValueSchema(definition.output.schema, 'schema', false, new Set())
  const output: ToolOutput = {
    schema: outputSchema,
    render: definition.output.render ?? (() => []),
  }
  const normalized = {
    name: definition.name,
    description: definition.description,
    parameters,
    output,
    ...(definition.timeoutMs !== undefined ? { timeoutMs: definition.timeoutMs } : {}),
    ...(definition.isConcurrencySafe === true ? { isConcurrencySafe: () => true } : {}),
    execute: definition.execute,
  }

  return normalized as T
}
