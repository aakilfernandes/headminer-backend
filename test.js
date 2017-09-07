const getProcessingPriorities = require('./lib/getProcessingPriorities')

console.log(getProcessingPriorities())

getProcessingPriorities().then((priorities) => {
  console.log(priorities)
})
