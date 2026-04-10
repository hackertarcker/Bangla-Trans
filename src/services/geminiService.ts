import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const translateText = async (text: string, sourceLang: string, targetLang: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Translate the following text from ${sourceLang} to ${targetLang}. 
      Ensure the translation is semantic, contextual, and culturally appropriate for Bangla speakers.
      
      Text: ${text}`,
    });

    return response.text;
  } catch (error) {
    console.error("Gemini translation error:", error);
    throw error;
  }
};

export const transcribeAndTranslate = async (fileData: string, mimeType: string, targetLang: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: fileData,
              mimeType: mimeType,
            },
          },
          {
            text: `Transcribe this audio/video and translate it into ${targetLang}. 
            Provide the output as a JSON array of objects, where each object has:
            - startTime: (string, e.g., "00:00:01")
            - endTime: (string, e.g., "00:00:05")
            - originalText: (string)
            - translatedText: (string)
            
            Ensure the translation is natural and idiomatic Bangla.`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini multimodal error:", error);
    throw error;
  }
};
