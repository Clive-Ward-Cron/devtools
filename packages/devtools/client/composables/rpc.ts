import { createBirpc } from 'birpc'
import { parse, stringify } from 'flatted'
import { tryCreateHotContext } from 'vite-hot-client'
import type { ClientFunctions, ServerFunctions } from '../../src/types'
import { WS_EVENT_NAME } from '../../src/constant'

export const wsConnecting = ref(false)
export const wsError = ref<any>()
export const wsConnectingDebounced = useDebounce(wsConnecting, 2000)

const connectPromise = connectVite()
let onMessage: any = () => {}

export const clientFunctions = {
  // will be added in app.vue
} as ClientFunctions

export const extendedRpcMap = new Map<string, any>()

export const rpc = createBirpc<ServerFunctions>(clientFunctions, {
  post: async (d) => {
    (await connectPromise).send(WS_EVENT_NAME, d)
  },
  on: (fn) => {
    onMessage = fn
  },
  serialize: stringify,
  deserialize: parse,
  resolver(name, fn) {
    if (fn)
      return fn
    if (!name.includes(':'))
      return
    const [namespace, fnName] = name.split(':')
    return extendedRpcMap.get(namespace)?.[fnName]
  },
  onError(error, name) {
    console.error(`[nuxt-devtools] RPC error on executing "${name}":`, error)
  },
  timeout: 120_000,
})

async function connectVite() {
  // @ts-expect-error no types

  let base = window.__NUXT__.config?.app?.baseURL
  if (base && !base.endsWith('/'))
    base += '/'
  const hot = await tryCreateHotContext(undefined, [
    ...(base
      ? [`${base}_nuxt/`, base]
      : []),
    '/_nuxt/',
    '/',
  ])

  if (!hot)
    throw new Error('Unable to connect to devtools')

  hot.on(WS_EVENT_NAME, (data) => {
    onMessage(data)
  })

  // TODO:
  // hot.on('vite:connect', (data) => {})
  // hot.on('vite:disconnect', (data) => {})

  return hot
}
