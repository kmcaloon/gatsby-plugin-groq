/**
 * Put all of your GROQ "fragments" here!
 */

exports.demoString = `
  _id,
  title,
  content
`;

exports.demoFunction = num => {

  if( num === 2 ) {
    return(`
      _id,
      title
    `);
  }
  else {
    return(`
      _id
    `);
  }
  
}