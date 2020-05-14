/**
 * Put all of your GROQ "fragments" here!
 */

exports.getWorldsJobs = `
  * [ internal.type == "jobs" && ^.id in worlds[]._ref ] {
    client,
    crew,
    worlds,
  }
`;