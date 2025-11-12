require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, VoiceConnectionStatus, entersState, AudioPlayerStatus, StreamType } = require('@discordjs/voice');
const { Readable } = require('stream');

// ===== SERVIDOR HTTP PARA O RENDER =====
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send('🤖 Bot está online e funcionando!');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Servidor HTTP rodando na porta ${PORT}`);
});
// ===== FIM DO SERVIDOR HTTP =====

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences // <-- ADICIONADO
    ]
});

const TOKEN = process.env.TOKEN;
let connection = null;
let player = null;

function createSilenceStream() {
    const silenceFrame = Buffer.from([0xF8, 0xFF, 0xFE]);
    
    class SilenceStream extends Readable {
        _read() {
            this.push(silenceFrame);
        }
    }
    
    return new SilenceStream();
}

client.on('ready', () => {
    console.log(`✅ Bot conectado como ${client.user.tag}`);
    console.log('✅ Use !join para o bot entrar no canal de voz');
    
    // Define status como ONLINE com atividade
    client.user.setPresence({
        activities: [{ 
            name: '!join para entrar | !help', 
            type: ActivityType.Listening 
        }],
        status: 'online',
    });
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

            player = createAudioPlayer();
            
            const resource = createAudioResource(createSilenceStream(), {
                inputType: StreamType.Arbitrary,
                inlineVolume: true
            });
            
            resource.volume.setVolume(0);
            player.play(resource);
            connection.subscribe(player);
            
            player.on(AudioPlayerStatus.Idle, () => {
                const newResource = createAudioResource(createSilenceStream(), {
                    inputType: StreamType.Arbitrary,
                    inlineVolume: true
                });
                newResource.volume.setVolume(0);
                player.play(newResource);
            });

            console.log('✅ Conectado e tocando áudio silencioso (Anti-AFK ativo)');
            message.reply('✅ Entrei no canal! Estou tocando áudio silencioso para nunca ser kickado por AFK 🎵🔇');

            connection.on(VoiceConnectionStatus.Disconnected, async () => {
                try {
                    await Promise.race([
                        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                    ]);
                } catch (error) {
                    connection.destroy();
                    connection = null;
                    player = null;
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
            if (player) {
                player.stop();
                player = null;
            }
            connection.destroy();
            connection = null;
            message.reply('👋 Saí do canal de voz!');
            console.log('👋 Desconectado do canal de voz');
        } else {
            message.reply('❌ Não estou em nenhum canal de voz!');
        }
    }

    if (message.content === '!help') {
        message.reply('**Comandos:**\n`!join` - Entra no canal (Anti-AFK ativo)\n`!leave` - Sai do canal\n`!help` - Ajuda');
    }
});

client.login(TOKEN);