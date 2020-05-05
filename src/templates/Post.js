import React from 'react';

import { useGroqQuery } from '../../plugins/gatsby-plugin-groq';

// Lets add a page query...
// Now add a makeshift projection...
// We can update whatever we need on the fly...


// Cool...



export const groqQuery = `{
  "post": *[ _type == "post" && _id == $_id ] {
    slug,
    title,
    author,
    "authorData": *[ _type == "teamMember" && id == ^.author._ref ]{
      name,
      "photo": photo.asset->{
        url,
        metadata
      }
    }[0]
  }[0]
}`;
export const Post = ( { pageContext } ) => {

  const { post } = pageContext.data || { post: {} };

  console.log( post );

  // Now lets add a static query...
  const contact = useGroqQuery( `
    * [ _id == "settingsContact" ] {
      nyEmail
    }[0]
  ` );


  return(

    <div style={ { padding: '4rem' } }>

      <h1>{ post.title }</h1>
      <p>{ post.summary }</p>

      { !! post.authorData &&

        <>
          <h3>Author: { post.authorData.name }</h3>
          <img src={ post.authorData.photo.url } />
        </>
      }

      { !! contact &&
        <h4>Contact Us: { contact.nyEmail }</h4>
      }

    </div>
  )

}
export default Post;