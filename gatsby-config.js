require( 'dotenv' ).config({
  path: `.env`,
} );

module.exports = {
  plugins: [
    'gatsby-plugin-groq',
    {
      resolve: 'gatsby-source-sanity',
      options: {
        projectId:     process.env.SANITY_PROJECT,
        dataset:       process.env.SANITY_DATASET,
        token:         process.env.SANITY_TOKEN,
        overlayDrafts: process.env.NODE_ENV === 'development' ? true : false,
        watchMode:     process.env.NODE_ENV === 'development' ? true : false,
      }
    },
  ],
}
