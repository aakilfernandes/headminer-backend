const restify = require('restify')
const mysqlQuery = require('./lib/mysqlQuery')
const _ = require('lodash')
const getQs = require('./lib/getQs')
const getArticles = require('./lib/getArticles')
const incrementArticlesPriorities = require('./lib/incrementArticlesPriorities')
const Promise = require('bluebird')
const restifyPromise = require('restify-await-promise')
const endpoints = require('./lib/endpoints')
const fs = require('./lib/fs')

Date.prototype.toJSON = function toJSON(){
   return this.getTime()
}

const server = restify.createServer({
  name: 'headminer',
  version: '1.0.0'
})

restifyPromise.install(server, {
  logger: console
})

server.use(restify.plugins.acceptParser(server.acceptable))
server.use(restify.plugins.queryParser())
server.use(restify.plugins.bodyParser())
server.use(function crossOrigin(req,res,next){
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "X-Requested-With")
  return next()
})

_.map(endpoints, (endpoint, url) => {
  server.get(url, (request, response) => {
    if (endpoint.cache_ms === 0) {
      return endpoint.handler(request.params)
    }

    const cache_path = getCachePath(request.url)

    return fs.readFileAsync(cache_path, 'utf8').then((cached_json) => {
      const cached = JSON.parse(cached_json)
      if (Number.isNaN(endpoint.cache_ms)) {
        console.log('return cached')
        return cached.value
      }
      if (Date.now() - cached.cached_at < endpoint.cache_ms) {
        console.log('return cached 2')
        return cached.value
      }
      console.log('return handleAndCache')
      return endpoint.handleAndCache(request.params, cache_path)
    }, () => {
      return endpoint.handleAndCache(request.params, cache_path)
    }).then((value) => {
      if (endpoint.postHandle) {
        endpoint.postHandle(value)
      }
      return value
    })
  })
})

function getCachePath(url) {

  let cache_file = url

  if (cache_file.substr(0, 1) === '/') {
    cache_file = cache_file.substr(1)
  }

  if (cache_file.substr(-1) === '/') {
    cache_file = cache_file.substr(-1)
  }

  cache_file = encodeURIComponent(cache_file)

  return `${__dirname}/cache/${cache_file}.json`
}

server.listen(4001, function () {
  console.log('%s listening at %s', server.name, server.url);
})
