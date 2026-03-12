package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path"
	"strings"
	"time"
)

type gltfDoc struct {
	Buffers []struct {
		URI string `json:"uri"`
	} `json:"buffers"`
	Images []struct {
		URI string `json:"uri"`
	} `json:"images"`
}

func main() {
	base := flag.String("base", "http://localhost:8080/static/models", "base URL for model assets")
	models := flag.String("models", "", "comma-separated model ids")
	flag.Parse()

	if strings.TrimSpace(*models) == "" {
		fmt.Fprintln(os.Stderr, "missing --models")
		os.Exit(1)
	}

	baseURL, err := url.Parse(strings.TrimRight(*base, "/"))
	if err != nil {
		fmt.Fprintf(os.Stderr, "invalid base url: %v\n", err)
		os.Exit(1)
	}

	modelIDs := splitList(*models)
	client := &http.Client{Timeout: 10 * time.Second}

	var missing []string
	for _, id := range modelIDs {
		gltfURL := joinURL(baseURL, id, "model.gltf")
		doc, err := fetchGLTF(client, gltfURL)
		if err != nil {
			missing = append(missing, fmt.Sprintf("%s: %v", gltfURL, err))
			continue
		}

		uris := collectURIs(doc)
		for _, uri := range uris {
			if uri == "" || strings.HasPrefix(uri, "data:") {
				continue
			}
			if strings.Contains(uri, "://") {
				missing = append(missing, fmt.Sprintf("%s: external uri not allowed (%s)", id, uri))
				continue
			}
			assetURL := joinURL(baseURL, id, uri)
			if err := checkURL(client, assetURL); err != nil {
				missing = append(missing, fmt.Sprintf("%s: %v", assetURL, err))
			}
		}
	}

	if len(missing) > 0 {
		fmt.Fprintln(os.Stderr, "validate-assets failed:")
		for _, m := range missing {
			fmt.Fprintln(os.Stderr, " -", m)
		}
		os.Exit(1)
	}

	fmt.Println("validate-assets ok")
}

func splitList(v string) []string {
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func fetchGLTF(client *http.Client, u string) (gltfDoc, error) {
	resp, err := client.Get(u)
	if err != nil {
		return gltfDoc{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return gltfDoc{}, fmt.Errorf("status %d", resp.StatusCode)
	}

	var doc gltfDoc
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return gltfDoc{}, fmt.Errorf("invalid gltf json: %w", err)
	}
	return doc, nil
}

func collectURIs(doc gltfDoc) []string {
	out := make([]string, 0, len(doc.Buffers)+len(doc.Images))
	for _, b := range doc.Buffers {
		out = append(out, b.URI)
	}
	for _, img := range doc.Images {
		out = append(out, img.URI)
	}
	return out
}

func checkURL(client *http.Client, u string) error {
	req, err := http.NewRequest(http.MethodHead, u, nil)
	if err != nil {
		return err
	}
	resp, err := client.Do(req)
	if err == nil && resp != nil {
		resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			return nil
		}
		if resp.StatusCode != http.StatusMethodNotAllowed && resp.StatusCode != http.StatusNotImplemented {
			return fmt.Errorf("status %d", resp.StatusCode)
		}
	}

	req, err = http.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Range", "bytes=0-0")
	resp, err = client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusPartialContent {
		return nil
	}
	return fmt.Errorf("status %d", resp.StatusCode)
}

func joinURL(base *url.URL, parts ...string) string {
	out := *base
	all := append([]string{out.Path}, parts...)
	out.Path = path.Join(all...)
	return out.String()
}
