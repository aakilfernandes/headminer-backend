const htmlparser = require('htmlparser2')

module.exports = function parseHtml(html) {
  const parsed = {
    links: {},
    meta: {}
  }
  let isTitle = false
  let isDescription = false
  const parser = new htmlparser.Parser({
    onopentag: (name, attribs) => {
      if (name === 'link' && attribs.rel && attribs.href) {
        parsed.links[attribs.rel] = attribs.href
      }
      if (name === 'meta' && attribs.property && attribs.content) {
        parsed.meta[attribs.property] = attribs.content
      }
      if (name === 'meta' && attribs.name && attribs.content) {
        parsed.meta[attribs.name] = attribs.content
      }
      if (name === 'title') {
        isTitle = true
      }
      if (name === 'description') {
        isDescription = true
      }
    },
    ontext: (text) => {
      if (isTitle) {
        parsed.title = text
      } else if (isDescription) {
        parsed.description = text
      }
    },
    onclosetag: () => {
      isTitle = false
      isDescription = false
    }
  }, {
    decodeEntities: true
  })
  parser.write(html)
  return parsed
}
