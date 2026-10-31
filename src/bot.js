import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js'
import { state, save, addEvent } from './store.js'
import { checkLive } from './live.js'

const PING = process.env.PING || '@here'
const EPHEMERAL = { flags: MessageFlags.Ephemeral }
const LIVE_COLOR = 1381400
const liveUrl = username => `https://www.tiktok.com/@${username}/live`

export const client = new Client({ intents: [GatewayIntentBits.Guilds] })

export const notify = async payload => {
  const targets = Object.values(state.channels)
  if (!targets.length) return console.error('notify: no channel set, run /channel in discord')
  await Promise.all(targets.map(async id => {
    const channel = await client.channels.fetch(id).catch(() => null)
    if (!channel?.isTextBased?.()) return console.error(`notify: channel ${id} not usable, run /channel again`)
    await channel.send(payload).catch(e => console.error(`notify ${id} failed:`, e.message))
  }))
}

export const livePayload = ({ username, room }) => ({
  content: `${PING} 🔴 **${room.nickname || username}** is live on TikTok`,
  embeds: [
    new EmbedBuilder()
      .setTitle(room.title || 'TikTok LIVE')
      .setColor(LIVE_COLOR)
      .setAuthor({ name: room.nickname || username, ...(room.avatar ? { iconURL: room.avatar } : {}) })
      .addFields(
        { name: 'Creator', value: `[@${username}](https://www.tiktok.com/@${username})`, inline: true },
        { name: 'Viewers', value: String(room.viewers ?? 0), inline: true },
        { name: 'Started', value: room.startTime ? `<t:${room.startTime}:R>` : '—', inline: true },
      ),
  ],
  components: [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Watch Live').setURL(liveUrl(username)),
    ),
  ],
})

export const announceLive = args => notify(livePayload(args))

export const announceOffline = ({ username, room }) => notify({
  content: `⚫ **${room.nickname || username}** ended the TikTok live.`,
})

const definitions = [
  new SlashCommandBuilder()
    .setName('track')
    .setDescription('Manage tracked TikTok creators')
    .addSubcommand(s => s
      .setName('add')
      .setDescription('Track a creator and alert when they go live')
      .addStringOption(o => o.setName('username').setDescription('TikTok username, with or without @').setRequired(true)))
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('Stop tracking a creator')
      .addStringOption(o => o.setName('username').setDescription('TikTok username').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List tracked creators')),
  new SlashCommandBuilder().setName('channel').setDescription('Post live alerts in this channel'),
  new SlashCommandBuilder().setName('status').setDescription('Show current live status of tracked creators'),
]

const rest = new REST().setToken(process.env.DISCORD_TOKEN)

export const registerCommands = applicationId => rest.put(
  process.env.GUILD_ID
    ? Routes.applicationGuildCommands(applicationId, process.env.GUILD_ID)
    : Routes.applicationCommands(applicationId),
  { body: definitions.map(d => d.toJSON()) },
)

const statusLine = username => {
  const s = state.status[username]
  if (s?.error) return `**@${username}** — ⚠️ ${s.error}`
  if (s?.live) return `**@${username}** — 🔴 live · ${s.viewers} viewers${s.title ? ` · ${s.title}` : ''}`
  return `**@${username}** — ⚫ offline`
}

const guildChannel = guildId => (guildId ? state.channels[guildId] : null)

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return
  try {
    if (interaction.commandName === 'channel') {
      // Alerts are per server: a second server setting its own channel must not
      // steal the first one's.
      if (!interaction.guildId) return interaction.reply({ content: 'Run this in a server.', ...EPHEMERAL })
      state.channels[interaction.guildId] = interaction.channelId
      await save()
      return interaction.reply({ content: 'Live alerts will be posted here.', ...EPHEMERAL })
    }

    if (interaction.commandName === 'status') {
      return interaction.reply({
        content: state.creators.length
          ? state.creators.map(c => statusLine(c.username)).join('\n')
          : 'Nothing tracked yet. Use `/track add`.',
        ...EPHEMERAL,
      })
    }

    const sub = interaction.options.getSubcommand()

    if (sub === 'list') {
      return interaction.reply({
        content: `Tracked: ${state.creators.map(c => `@${c.username}`).join(', ') || 'none'}\n`
          + `Alerts go to: ${guildChannel(interaction.guildId) ? `<#${guildChannel(interaction.guildId)}>` : 'not set, run `/channel`'}`,
        ...EPHEMERAL,
      })
    }

    const username = interaction.options.getString('username').replace(/^@/, '').trim().toLowerCase()

    if (sub === 'remove') {
      const before = state.creators.length
      state.creators = state.creators.filter(c => c.username !== username)
      delete state.status[username]
      if (state.creators.length === before) {
        return interaction.reply({ content: `@${username} is not tracked.`, ...EPHEMERAL })
      }
      await save()
      return interaction.reply({ content: `Stopped tracking @${username}.`, ...EPHEMERAL })
    }

    if (state.creators.some(c => c.username === username)) {
      return interaction.reply({ content: `@${username} is already tracked.`, ...EPHEMERAL })
    }

    await interaction.deferReply(EPHEMERAL)
    try {
      await checkLive(username)
    } catch (e) {
      return interaction.editReply(`Cannot find @${username} on TikTok (${e.message}).`)
    }
    state.creators.push({ username, addedAt: Date.now() })
    await save()
    addEvent('tracked', username)
    return interaction.editReply(
      `Tracking @${username}.${guildChannel(interaction.guildId) ? '' : ' Set a channel with `/channel` to get alerts.'}`,
    )
  } catch (e) {
    console.error(e)
    const reply = { content: `Error: ${e.message}`, ...EPHEMERAL }
    if (interaction.deferred || interaction.replied) interaction.editReply(reply).catch(() => {})
    else interaction.reply(reply).catch(() => {})
  }
})

export const startBot = async () => {
  await client.login(process.env.DISCORD_TOKEN)
  await client.application.fetch()
  await registerCommands(client.application.id)
  client.user.setActivity('TikTok lives')
  return client
}
