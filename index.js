const { Client, GatewayIntentBits, ActivityType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fetch = require('node-fetch');
const config = require('./config.json');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const personalityPrompt = "You're a Chatbot on discord";

client.once('ready', () => {
  console.log(`[AI] Installed on ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.mentions.has(client.user)) {
    const prompt = message.content.replace(`<@${client.user.id}>`, '').trim();
    if (!prompt) return message.reply("Hello, Friend");

    await message.channel.sendTyping();

    // 🔹 IMAGE generation
    if (
      prompt.toLowerCase().startsWith('imagine') ||
      prompt.toLowerCase().startsWith('generate') ||
      prompt.toLowerCase().startsWith('image')
    ) {
      const imagePrompt = prompt.replace(/^(imagine|generate|image)\s+/i, '');
      try {
        const response = await fetch('https://api.navy/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.NAVY_API_KEY}`
          },
          body: JSON.stringify({
            prompt: imagePrompt,
            model: "dall-e-3",
            n: 1,
            size: "1024x1024"
          })
        });

        const data = await response.json();
        const imageUrl = data.data?.[0]?.url;
        if (!imageUrl) return message.reply("Couldn't generate the image.");

        const embed = new EmbedBuilder()
          .setTitle("🎨 AI Image Generated")
          .setDescription("Here's your image based on the prompt.")
          .setImage(imageUrl)
          .setColor("#25a9ff");

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("Download Image")
            .setStyle(ButtonStyle.Link)
            .setURL(imageUrl)
        );

        return message.reply({ embeds: [embed], components: [row] });
      } catch (error) {
        console.error("[IMAGE ERROR]", error);
        return message.reply("Failed to generate image.");
      }
    }

    // 🔹 AUDIO (TTS)
    if (prompt.toLowerCase().startsWith('say')) {
      const sayText = prompt.slice(4).trim();
      try {
        const audioRes = await fetch("https://api.navy/tts", {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.NAVY_API_KEY}`
          },
          body: JSON.stringify({
            text: sayText,
            voice: "will"
          })
        });

        const buffer = await audioRes.buffer();
        const audioPath = path.join(__dirname, 'voice.mp3');
        fs.writeFileSync(audioPath, buffer);

        return message.reply({ files: [audioPath] });
      } catch (err) {
        console.error("[AUDIO ERROR]", err);
        return message.reply("Failed to say something");
      }
    }

    // 🔹 TEXT REPLY
    try {
      const response = await fetch('https://api.navy/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.NAVY_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: personalityPrompt },
            { role: "user", content: prompt }
          ]
        })
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        console.error('[NAVY API JSON ERROR]', text);
        return message.reply("Sorry, I didn't understand the response.");
      }

      const reply = data.choices?.[0]?.message?.content || "I'm not sure how to respond to that.";

      if (reply.length <= 2000) {
        message.reply(reply);
      } else {
        const chunks = reply.match(/[\s\S]{1,1999}/g);
        for (const chunk of chunks) {
          await message.channel.send(chunk);
        }
      }
    } catch (err) {
      console.error('[AI BOT ERROR]', err);
      message.reply("Something went wrong while responding.");
    }
  }
});

client.login(config.BOT_TOKEN);
