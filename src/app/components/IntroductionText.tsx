import React from 'react';
import ReactMarkdown from 'react-markdown';

const IntroductionText: React.FC = () => {
  const markdown = `
*Please make a selection drawing a circle on the graph. Scroll down, they'll all be rendered below!*

Welcome! I made this sketch to introduce you to how I think, and the type of tools I build, to handle problems like observing large amounts of conversation data, and using those insights to tune up my systems' performance.

This started as a conversation dataset on huggingface: [lmsys-chat-1m](https://huggingface.co/datasets/lmsys/lmsys-chat-1m), 1Million interactions with various chatbots in chatbot arena. I pared it down to 50,000 english language conversations with the vicuna-13b model (a fine-tuned Llama). I chose this number mostly so I could cram it into my free tier MongoDB cluster with some wiggle room for vector embedings.

I summarized, embedded, and UMAP-reduced the data to give you the 2D scatterplot you see above. I like data maps like this; if you revisit it over time, you start to build a relationship with where you expect the data to fall on the map, and it gives you a nice spatial layout of a ton of conversations all at once. When tuned up, some clearer groupings start to form.

You can make a selection by drawing a circle around datapoints on the map. You can ask questions or produce summaries about the selection, which will grab embedding-relevant conversations from the dataset alongeside your collection. Little QA systems like this help explore the data, and gather up patterns as you explore your cursiosities.

Mark questions as performing well or performing poorly so we can start building a picture of the failure patterns of the system.

I love working in this space, and I've found tools like this carry a lot of leverage when put to practice. Thanks for visiting!

– Phillip
  `;

  return (
    <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <ReactMarkdown className="prose dark:prose-invert max-w-none">
        {markdown}
      </ReactMarkdown>
    </div>
  );
};

export default IntroductionText;