import axios from "axios";
import { kv } from "@vercel/kv";

const MAX_USAGE = 100;
const COOLDOWN = 3000;

export default async function handler(req, res) {
    try {
        const q = req.query.q;

        if (!q) {
            return res.status(400).json({
                status: false,
                message: "Parameter q diperlukan"
            });
        }

        const ip =
            req.headers["x-forwarded-for"]?.split(",")[0] ||
            req.headers["x-real-ip"] ||
            "unknown";
         const ua = req.headers["user-agent"] || "";

        if (!ua || ua.length < 10) {
            return res.status(403).json({
                status: false,
                message: "Bot terdeteksi"
            });
        }

        const usageKey = `usage:${ip}`;
        const cooldownKey = `cooldown:${ip}`;

        const usage = (await kv.get(usageKey)) || 0;

        if (usage >= MAX_USAGE) {
            return res.status(429).json({
                status: false,
                message: "Limit penggunaan habis",
                limit: MAX_USAGE
            });
        }

        const lastRequest = await kv.get(cooldownKey);

        if (
            lastRequest &&
            Date.now() - Number(lastRequest) < COOLDOWN
        ) {
            return res.status(429).json({
                status: false,
                message: "Terlalu cepat, tunggu beberapa detik"
            });
        }

        await kv.set(cooldownKey, Date.now());

        const SYSTEM_PROMPT = `
Kamu adalah AI Programming Expert.

ATURAN:

- Fokus pada coding.
- Ahli JavaScript, Node.js, Express, React, HTML, CSS, Python, Java, Go, PHP, C++, SQL.
- Jika user meminta script/program:
  keluarkan HANYA kode.
- Jangan gunakan markdown.
- Jangan gunakan triple backticks.
- Jangan menjelaskan kode.
- Jangan menambahkan kalimat pembuka.
- Gunakan best practice modern.
- Sertakan error handling.
- Buat kode siap pakai.
- Jika user meminta penjelasan konsep, jawab singkat dan teknis.
`;

        const response = await axios.post(
            "https://api.z.ai/api/paas/v4/chat/completions",
            {
                model: "glm-5",
                messages: [
                    {
                        role: "system",
                        content: SYSTEM_PROMPT
                    },
                    {
                        role: "user",
                        content: q
                    }
                ],
                thinking: {
                    type: "enabled"
                },
                temperature: 0.7,
                max_tokens: 4096
            },
            {
                headers: {
                    Authorization: `Bearer 003b2126660f46fca3eed03a0d8d80ed.wq4loubZSmYbEmDD`,
                    "Content-Type": "application/json"
                },
                timeout: 120000
            }
        );

        await kv.set(usageKey, usage + 1);

        return res.status(200).json({
            status: true,
            usage: usage + 1,
            limit: MAX_USAGE,
            result:
                response.data?.choices?.[0]?.message?.content ||
                "No response"
        });
    } catch (err) {
        return res.status(500).json({
            status: false,
            error:
                err.response?.data ||
                err.message ||
                "Internal Server Error"
        });
    }
}
