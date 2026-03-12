package httpapi

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	visualUploadMaxBytes = 8 << 20
	visualTTL            = 15 * time.Minute
)

type lensRefinement struct {
	Category string   `json:"category"`
	Query    string   `json:"query"`
	Keywords []string `json:"keywords"`
	Notes    string   `json:"notes"`
}

type lensResponse struct {
	ImageURL         string         `json:"imageUrl"`
	LensURL          string         `json:"lensUrl"`
	Refinement       lensRefinement `json:"refinement"`
	RefinementError  string         `json:"refinementError,omitempty"`
}

func (s *Server) HandleLens(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if s.PublicBaseURL == "" {
		http.Error(w, "PUBLIC_BASE_URL missing", http.StatusInternalServerError)
		return
	}
	if s.StaticDir == "" {
		http.Error(w, "STATIC_DIR missing", http.StatusInternalServerError)
		return
	}
	if s.OpenAIKey == "" {
		http.Error(w, "OPENAI_API_KEY missing", http.StatusInternalServerError)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, visualUploadMaxBytes)
	if err := r.ParseMultipartForm(visualUploadMaxBytes); err != nil {
		http.Error(w, "invalid multipart form", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("image")
	if err != nil {
		http.Error(w, "image missing", http.StatusBadRequest)
		return
	}
	defer file.Close()

	if header != nil && header.Size > visualUploadMaxBytes {
		http.Error(w, "image too large", http.StatusBadRequest)
		return
	}

	token, err := randomToken(16)
	if err != nil {
		http.Error(w, "failed to create token", http.StatusInternalServerError)
		return
	}

	dir := filepath.Join(s.StaticDir, "tmp", "visual")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		http.Error(w, "failed to create temp dir", http.StatusInternalServerError)
		return
	}

	dstPath := filepath.Join(dir, fmt.Sprintf("%s.png", token))
	imgBytes, err := writeMultipartFile(dstPath, file)
	if err != nil {
		http.Error(w, "failed to save image", http.StatusInternalServerError)
		return
	}
	if len(imgBytes) == 0 {
		http.Error(w, "empty image", http.StatusBadRequest)
		return
	}

	imgURL := strings.TrimRight(s.PublicBaseURL, "/") + "/tmp/visual/" + token + ".png"

	ctx, cancel := context.WithTimeout(r.Context(), 18*time.Second)
	defer cancel()
	dataURL := "data:image/png;base64," + base64.StdEncoding.EncodeToString(imgBytes)
	refinement, err := s.refineLensPayload(ctx, dataURL)
	refineErr := ""
	if err != nil {
		refineErr = err.Error()
		// keep going: still return Lens URL so user can search manually
		refinement = lensRefinement{
			Category: "",
			Query:    "",
			Keywords: nil,
			Notes:    "Refinement unavailable. You can still use Google Lens directly.",
		}
	}

	// cleanup in background
	time.AfterFunc(visualTTL, func() {
		_ = os.Remove(dstPath)
	})

	lensURL := "https://lens.google.com/uploadbyurl?url=" + url.QueryEscape(imgURL)
	writeJSON(w, http.StatusOK, lensResponse{
		ImageURL:        imgURL,
		LensURL:         lensURL,
		Refinement:      refinement,
		RefinementError: refineErr,
	})
}

func (s *Server) HandleTempVisual(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	token := r.PathValue("token")
	if token == "" {
		http.NotFound(w, r)
		return
	}
	name := token
	if !strings.HasSuffix(name, ".png") {
		name = name + ".png"
	}
	if strings.Contains(name, "..") || strings.ContainsAny(name, "/\\") {
		http.NotFound(w, r)
		return
	}
	path := filepath.Join(s.StaticDir, "tmp", "visual", name)
	if _, err := os.Stat(path); err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	http.ServeFile(w, r, path)
}

func randomToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func writeMultipartFile(path string, file multipart.File) ([]byte, error) {
	var buf bytes.Buffer
	if _, err := io.Copy(&buf, file); err != nil {
		return nil, err
	}
	if err := os.WriteFile(path, buf.Bytes(), 0o644); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

type openAIResponse struct {
	Output []struct {
		Type    string `json:"type"`
		Content []struct {
			Type    string          `json:"type"`
			Text    string          `json:"text,omitempty"`
			JSON    json.RawMessage `json:"json,omitempty"`
			Refusal string          `json:"refusal,omitempty"`
		} `json:"content"`
	} `json:"output"`
	Error any `json:"error"`
}

func (s *Server) refineLensPayload(ctx context.Context, imgURL string) (lensRefinement, error) {
	refine := lensRefinement{}
	body := map[string]any{
		"model": "gpt-4o-mini",
		"input": []any{
			map[string]any{
				"role": "user",
				"content": []any{
					map[string]any{
						"type": "input_text",
						"text": "Look at this product image and produce a shopping refinement payload. Return JSON only.",
					},
					map[string]any{
						"type": "input_image",
						"image_url": imgURL,
					},
				},
			},
		},
		"text": map[string]any{
			"format": map[string]any{
				"type":  "json_schema",
				"name":  "lens_refine",
				"strict": true,
				"schema": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"category": map[string]any{"type": "string"},
						"query":    map[string]any{"type": "string", "minLength": 1, "maxLength": 120},
						"keywords": map[string]any{
							"type":     "array",
							"minItems": 3,
							"maxItems": 10,
							"items":    map[string]any{"type": "string"},
						},
						"notes": map[string]any{"type": "string"},
					},
					"required":             []string{"category", "query", "keywords", "notes"},
					"additionalProperties": false,
				},
			},
		},
		"temperature":      0.2,
		"max_output_tokens": 120,
	}

	raw, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.openai.com/v1/responses", bytes.NewReader(raw))
	if err != nil {
		return refine, err
	}
	req.Header.Set("Authorization", "Bearer "+s.OpenAIKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return refine, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		msg := strings.TrimSpace(string(b))
		if msg == "" {
			msg = fmt.Sprintf("openai status %d", resp.StatusCode)
		}
		return refine, errors.New(msg)
	}

	var payload openAIResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return refine, err
	}
	if payload.Error != nil {
		return refine, errors.New("openai error")
	}

	text := extractOpenAIText(payload)
	if text == "" {
		return refine, errors.New("empty openai output")
	}

	if err := json.Unmarshal([]byte(text), &refine); err == nil {
		refine.Query = strings.TrimSpace(refine.Query)
		refine.Category = strings.TrimSpace(refine.Category)
		refine.Notes = strings.TrimSpace(refine.Notes)
		clean := make([]string, 0, len(refine.Keywords))
		seen := make(map[string]struct{})
		for _, k := range refine.Keywords {
			kk := strings.TrimSpace(k)
			if kk == "" {
				continue
			}
			low := strings.ToLower(kk)
			if _, ok := seen[low]; ok {
				continue
			}
			seen[low] = struct{}{}
			clean = append(clean, kk)
		}
		refine.Keywords = clean
		if refine.Query == "" {
			return refine, errors.New("empty query")
		}
		return refine, nil
	}

	return refine, errors.New("invalid openai json")
}

func extractOpenAIText(resp openAIResponse) string {
	for _, item := range resp.Output {
		if item.Type != "message" {
			continue
		}
		for _, c := range item.Content {
			if c.Type == "output_text" && strings.TrimSpace(c.Text) != "" {
				return c.Text
			}
			if c.Type == "output_json" && len(c.JSON) > 0 {
				return string(c.JSON)
			}
			if c.Refusal != "" {
				return ""
			}
		}
	}
	return ""
}
