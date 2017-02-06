import pathToRegexp from 'path-to-regexp'
import decache from 'decache'
import Logger from 'chalklog'
import path from 'path'
import chalk from 'chalk'
import url from 'url'
import fs from 'fs'
import { createFileSync, writeJSONSync, removeSync } from 'fs-extra'

export const log = new Logger('moky')

const readObjFromFile = (file, autoGenMock = false, defaultMock = {}) => {
  const jsonName = file + '.json'
  const jsName = file + '.js'
  if (!fs.existsSync(jsonName) && !fs.existsSync(jsName)) {
    log.red(`${file}.js{on} doesn't exists`)
    // Auto create mock file
    if (autoGenMock) {
      createFileSync(jsonName)
      writeJSONSync(jsonName, defaultMock)
      log.magenta(`Create file: ${jsonName}`)
    }
    return defaultMock
  }
  try {
    decache(file)
    return require(file)
  } catch (err) {
    log.red(err)
    return defaultMock
  }
}

export function mapUrlToPage (url, urlMaps) {
  for (let k in urlMaps) {
    if (pathToRegexp(k).test(url)) {
      return urlMaps[k]
    }
  }
  return null
}

export function parseConfig (absPath) {
  if (!fs.existsSync(absPath)) {
    log.red(`File not found: ${absPath}`)
    return {}
  }

  let config = require(absPath)
  // Required properties check
  for (let c of ['viewsPath', 'viewConfig', 'urlMaps']) {
    if (!config[c]) {
      log.red(`<${c}> is required`)
      return {}
    }
  }
  return config
}

export function getViewsMock (page, options) {
  const { viewsMockPath, autoGenMock = false, defaultMock = {} } = options
  if (!viewsMockPath) return {}
  const commonMock = readObjFromFile(
    path.join(viewsMockPath, '__COMMON__'),
    autoGenMock,
    defaultMock
  )
  const mockFile = path.join(viewsMockPath, page)
  return Object.assign(commonMock, readObjFromFile(mockFile, autoGenMock))
}

export function getAsyncMock (method, urlPath, options) {
  const { asyncMockPath, autoGenMock = false, defaultMock = {} } = options
  if (!asyncMockPath) {
    log.red(`urlPath: ${urlPath}, mockPath: ${asyncMockPath}, not exists`)
    return defaultMock
  }
  const mockFile = path.join(asyncMockPath, method.toLowerCase(), urlPath)
  return readObjFromFile(mockFile, autoGenMock, defaultMock)
}

export function hasProxyHeader (proxyRes) {
  return !!proxyRes._headers['x-proxy-header']
}

export function isJSON (str) {
  try {
    JSON.parse(str)
  } catch (e) {
    return false
  }
  return true
}

export function getPath (ctx, options) {
  const { urlMaps, viewsMockPath, asyncMockPath } = options
  // view request
  let page = mapUrlToPage(ctx.path, urlMaps)
  if (page) {
    if (page.startsWith('/')) page = page.substr(1)
    return path.join(viewsMockPath, page)
  }
  // async request
  return path.join(asyncMockPath, ctx.method.toLowerCase(), ctx.path)
}

export function writeMockBack (ctx, options, data) {
  // mock write option
  const rewrite = options.rewrite / 1
  const path = getPath(ctx, options)
  const jsonName = path + '.json'
  const jsName = path + '.js'

  if (!rewrite) return
  if (rewrite === 1 && (fs.existsSync(jsonName) || fs.existsSync(jsName))) return
  if (fs.existsSync(jsName)) removeSync(jsName)

  // Write to json file
  writeJSONSync(jsonName, data)
  log.yellow(`Write mock: ${jsonName}`)
  options.verbose && log.yellow(`Write mock data: ${data}`)
}

export function printProxyMaps (options = {}) {
  let print = false
  const proxies = Object.keys((options.proxyMaps || {}))
  if (proxies.length === 0) {
    print = 'No available proxyMaps'
  } else if ((typeof options.env === 'boolean') || // key without value
    (!url.parse(options.env)['protocol'] && !~proxies.indexOf(options.env))) {
    print = `Available proxyMaps: ${proxies.map(p => chalk.inverse(p)).join(' ')}`
  }
  if (print) console.log(print)
  return print
}
