const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const TOKEN = process.env.TOKEN;
let connection = null;

client.on('ready', () => {
    console.log(`✅ Bot conectado como ${client.user.tag}`);
    console.log('✅ Use !join para o bot entrar no canal de voz');
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!join') {
        if (!message.member.voice.channel) {
            return message.reply('❌ Você precisa estar em um canal de voz!');
        }

        try {
            connection = joinVoiceChannel({
                channelId: message.member.voice.channel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false
            });

            await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
            
            console.log('✅ Conectado ao canal de voz!');
            message.reply('✅ Entrei no canal de voz! Vou ficar aqui 24/7');

            connection.on(VoiceConnectionStatus.Disconnected, async () => {
                try {
                    await Promise.race([
                        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                    ]);
                } catch (error) {
                    connection.destroy();
                    connection = null;
                    console.log('❌ Desconectado do canal de voz');
                }
            });

        } catch (error) {
            console.error('Erro ao conectar:', error);
            message.reply('❌ Erro ao entrar no canal de voz!');
        }
    }

    if (message.content === '!leave') {
        if (connection) {
            connection.destroy();
            connection = null;
            message.reply('👋 Saí do canal de voz!');
            console.log('👋 Desconectado do canal de voz');
        } else {
            message.reply('❌ Não estou em nenhum canal de voz!');
        }
    }

    // Comando de ajuda
    if (message.content === '!help') {
        message.reply('**Comandos disponíveis:**\n`!join` - Bot entra no seu canal de voz\n`!leave` - Bot sai do canal de voz\n`!help` - Mostra esta mensagem');
    }
});

client.login(TOKEN);