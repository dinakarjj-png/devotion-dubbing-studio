const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

// ========================================
// CHECK API KEY
// ========================================

if (!ELEVENLABS_API_KEY) {
  console.error("ERROR: ELEVENLABS_API_KEY is not configured.");
} else {
  console.log("ElevenLabs API key detected.");
}

// ========================================
// MIDDLEWARE
// ========================================

app.use(cors({
  origin: "*"
}));

app.use(express.json());

// ========================================
// UPLOAD FOLDER
// ========================================

const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true
  });
}

// ========================================
// MULTER UPLOAD SETTINGS
// ========================================

const upload = multer({
  dest: uploadDir,

  limits: {
    fileSize: 500 * 1024 * 1024
  }
});

// ========================================
// ELEVENLABS HEADERS
// ========================================

function elevenHeaders() {
  return {
    "xi-api-key": ELEVENLABS_API_KEY
  };
}

// ========================================
// ERROR HELPER
// ========================================

async function readElevenLabsError(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch (error) {
    return {
      message:
        text ||
        `ElevenLabs returned HTTP ${response.status}`
    };
  }
}

// ========================================
// HOME
// ========================================

app.get("/", (req, res) => {
  res.json({
    message: "Devotion Dubbing Studio API is running!",
    status: "success",
    dubbingEngine: "ElevenLabs Dubbing v2"
  });
});

// ========================================
// HEALTH CHECK
// ========================================

app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    elevenlabs_configured:
      Boolean(ELEVENLABS_API_KEY),
    service:
      "Devotion Dubbing Studio Backend"
  });
});

// ========================================
// START DUBBING
//
// POST /api/dub
//
// Receives:
// - video
// - sourceLanguage
// - targetLanguage
// ========================================

app.post(
  "/api/dub",
  upload.single("video"),

  async (req, res) => {

    let localFilePath = null;

    try {

      // ------------------------------------
      // CHECK API KEY
      // ------------------------------------

      if (!ELEVENLABS_API_KEY) {

        return res.status(500).json({
          error:
            "ELEVENLABS_API_KEY is missing in Render Environment Variables."
        });

      }

      // ------------------------------------
      // CHECK VIDEO
      // ------------------------------------

      if (!req.file) {

        return res.status(400).json({
          error:
            "Please upload a video file."
        });

      }

      // ------------------------------------
      // GET LANGUAGES
      // ------------------------------------

      const {
        sourceLanguage,
        targetLanguage
      } = req.body;

      if (!targetLanguage) {

        return res.status(400).json({
          error:
            "Please select a target language."
        });

      }

      localFilePath = req.file.path;

      console.log(
        "Received video:",
        req.file.originalname
      );

      console.log(
        "Source language:",
        sourceLanguage || "auto"
      );

      console.log(
        "Target language:",
        targetLanguage
      );

      // ------------------------------------
      // READ UPLOADED FILE
      // ------------------------------------

      const fileBuffer =
        fs.readFileSync(localFilePath);

      // ------------------------------------
      // CREATE FORM DATA
      // ------------------------------------

      const formData =
        new FormData();

      const videoBlob =
        new Blob(
          [fileBuffer],
          {
            type:
              req.file.mimetype ||
              "video/mp4"
          }
        );

      formData.append(
        "file",
        videoBlob,
        req.file.originalname
      );

      formData.append(
        "reference",
        `Devotion Dubbing Studio - ${req.file.originalname}`
      );

      formData.append(
        "model_id",
        "dubbing_v2"
      );

      // ------------------------------------
      // SOURCE LANGUAGE
      // ------------------------------------

      if (
        sourceLanguage &&
        sourceLanguage !== "auto"
      ) {

        formData.append(
          "source_language",
          sourceLanguage
        );

      }

      // ------------------------------------
      // FIRST TARGET LANGUAGE
      // ------------------------------------

      formData.append(
        "target_language",
        targetLanguage
      );

      console.log(
        "Sending project to ElevenLabs..."
      );

      // ------------------------------------
      // CREATE ELEVENLABS PROJECT
      // ------------------------------------

      const response =
        await fetch(
          `${ELEVENLABS_BASE_URL}/dubbing/project`,
          {
            method: "POST",

            headers:
              elevenHeaders(),

            body: formData
          }
        );

      // ------------------------------------
      // HANDLE ERROR
      // ------------------------------------

      if (!response.ok) {

        const error =
          await readElevenLabsError(
            response
          );

        console.error(
          "ElevenLabs error:",
          error
        );

        return res
          .status(response.status)
          .json({
            error:
              "Unable to create ElevenLabs dubbing project.",
            details:
              error
          });

      }

      // ------------------------------------
      // SUCCESS
      // ------------------------------------

      const project =
        await response.json();

      console.log(
        "Dubbing project created:",
        project.project_id
      );

      res.json({

        success: true,

        projectId:
          project.project_id,

        projectStatus:
          project.status,

        sourceLanguage:
          project.source_language,

        languageIds:
          project.language_ids || [],

        message:
          "Real AI dubbing project created successfully."

      });

    } catch (error) {

      console.error(
        "DUBBING ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Failed to start dubbing.",

        details:
          error.message
      });

    } finally {

      // ------------------------------------
      // DELETE TEMPORARY UPLOADED FILE
      // ------------------------------------

      if (
        localFilePath &&
        fs.existsSync(localFilePath)
      ) {

        try {

          fs.unlinkSync(
            localFilePath
          );

          console.log(
            "Temporary upload deleted."
          );

        } catch (deleteError) {

          console.error(
            "Could not delete temporary file:",
            deleteError.message
          );

        }

      }

    }

  }
);

// ========================================
// GET PROJECT STATUS
//
// GET /api/dub/:projectId
// ========================================

app.get(
  "/api/dub/:projectId",

  async (req, res) => {

    try {

      if (!ELEVENLABS_API_KEY) {

        return res.status(500).json({
          error:
            "ELEVENLABS_API_KEY is missing."
        });

      }

      const {
        projectId
      } = req.params;

      const response =
        await fetch(
          `${ELEVENLABS_BASE_URL}/dubbing/project/${projectId}`,
          {
            headers:
              elevenHeaders()
          }
        );

      if (!response.ok) {

        const error =
          await readElevenLabsError(
            response
          );

        return res
          .status(response.status)
          .json({
            error:
              "Unable to get project status.",
            details:
              error
          });

      }

      const project =
        await response.json();

      res.json({

        success: true,

        projectId:
          project.project_id,

        status:
          project.status,

        sourceLanguage:
          project.source_language,

        languageIds:
          project.language_ids || [],

        media:
          project.media || null,

        warnings:
          project.warnings || [],

        error:
          project.error || null

      });

    } catch (error) {

      console.error(
        "PROJECT STATUS ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Failed to check project status.",
        details:
          error.message
      });

    }

  }
);

// ========================================
// CREATE ANOTHER TARGET LANGUAGE
//
// POST /api/dub/:projectId/language
// ========================================

app.post(
  "/api/dub/:projectId/language",

  async (req, res) => {

    try {

      if (!ELEVENLABS_API_KEY) {

        return res.status(500).json({
          error:
            "ELEVENLABS_API_KEY is missing."
        });

      }

      const {
        projectId
      } = req.params;

      const {
        targetLanguage
      } = req.body;

      if (!targetLanguage) {

        return res.status(400).json({
          error:
            "targetLanguage is required."
        });

      }

      console.log(
        "Creating additional language:",
        targetLanguage
      );

      const response =
        await fetch(
          `${ELEVENLABS_BASE_URL}/dubbing/project/${projectId}/language`,
          {
            method: "POST",

            headers: {
              ...elevenHeaders(),

              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                target_language:
                  targetLanguage
              })
          }
        );

      if (!response.ok) {

        const error =
          await readElevenLabsError(
            response
          );

        return res
          .status(response.status)
          .json({
            error:
              "Unable to create target language.",
            details:
              error
          });

      }

      const language =
        await response.json();

      res.json({

        success: true,

        projectId:
          projectId,

        languageId:
          language.language_id,

        targetLanguage:
          language.target_language,

        status:
          language.status

      });

    } catch (error) {

      console.error(
        "CREATE LANGUAGE ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Failed to create target language.",
        details:
          error.message
      });

    }

  }
);

// ========================================
// GET ALL LANGUAGE TARGETS
//
// GET /api/dub/:projectId/languages
// ========================================

app.get(
  "/api/dub/:projectId/languages",

  async (req, res) => {

    try {

      const {
        projectId
      } = req.params;

      const response =
        await fetch(
          `${ELEVENLABS_BASE_URL}/dubbing/project/${projectId}/language`,
          {
            headers:
              elevenHeaders()
          }
        );

      if (!response.ok) {

        const error =
          await readElevenLabsError(
            response
          );

        return res
          .status(response.status)
          .json({
            error:
              "Unable to get languages.",
            details:
              error
          });

      }

      const result =
        await response.json();

      res.json({
        success: true,
        projectId,
        languages:
          result.languages || []
      });

    } catch (error) {

      res.status(500).json({
        error:
          "Failed to get languages.",
        details:
          error.message
      });

    }

  }
);

// ========================================
// GET SPECIFIC LANGUAGE STATUS
//
// GET /api/dub/:projectId/language/:languageId
// ========================================

app.get(
  "/api/dub/:projectId/language/:languageId",

  async (req, res) => {

    try {

      if (!ELEVENLABS_API_KEY) {

        return res.status(500).json({
          error:
            "ELEVENLABS_API_KEY is missing."
        });

      }

      const {
        projectId,
        languageId
      } = req.params;

      const response =
        await fetch(
          `${ELEVENLABS_BASE_URL}/dubbing/project/${projectId}/language/${languageId}`,
          {
            headers:
              elevenHeaders()
          }
        );

      if (!response.ok) {

        const error =
          await readElevenLabsError(
            response
          );

        return res
          .status(response.status)
          .json({
            error:
              "Unable to get language status.",
            details:
              error
          });

      }

      const language =
        await response.json();

      res.json({

        success: true,

        projectId,

        languageId:
          language.language_id,

        targetLanguage:
          language.target_language,

        status:
          language.status,

        outputs:
          language.outputs || null,

        warnings:
          language.warnings || [],

        error:
          language.error || null

      });

    } catch (error) {

      console.error(
        "LANGUAGE STATUS ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Failed to check language status.",
        details:
          error.message
      });

    }

  }
);

// ========================================
// FALLBACK 404
//
// KEEP THIS LAST
// ========================================

app.use(
  (req, res) => {

    res.status(404).json({
      error: "Route not found",
      path: req.originalUrl
    });

  }
);

// ========================================
// START SERVER
// ========================================

app.listen(
  PORT,
  () => {

    console.log(
      `Devotion Dubbing Studio backend running on port ${PORT}`
    );

  }
);
