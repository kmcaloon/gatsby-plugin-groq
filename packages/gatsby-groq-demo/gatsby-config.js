
/**
 * Set up json transformers and
 * configure groq plugin.
 */
module.exports = {
  plugins: [
    {
      resolve: 'gatsby-plugin-groq',
      options: {
        // Change this if you change the fragments index.
        fragmentsDir: './src/fragments',
      }
    },
    {
      resolve: 'gatsby-transformer-json',
      options: {
        typeName: ( { node, object, isArray } ) => node.relativeDirectory,
      }
    },
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        path: './src/data/',
      }
    },
  ],
}
