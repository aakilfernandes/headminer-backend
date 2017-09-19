module.exports = function getCachePath(url, path) {

  let cache_file = url

  if (cache_file.substr(0, 1) === '/') {
    cache_file = cache_file.substr(1)
  }

  if (cache_file.substr(-1) === '/') {
    cache_file = cache_file.substr(-1)
  }

  cache_file = encodeURIComponent(cache_file)

  return `${__dirname}/../cache/${cache_file}.json`
}
