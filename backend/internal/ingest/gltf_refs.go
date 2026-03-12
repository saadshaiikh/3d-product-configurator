package ingest

import (
	"encoding/json"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strings"
)

type GLTFRefs struct {
	Buffers []string
	Images  []string
}

type gltfDoc struct {
	Buffers []struct {
		URI string `json:"uri"`
	} `json:"buffers"`
	Images []struct {
		URI string `json:"uri"`
	} `json:"images"`
}

func ValidateGLTFRefs(modelDir string) (GLTFRefs, error) {
	gltfPath := filepath.Join(modelDir, "model.gltf")
	data, err := os.ReadFile(gltfPath)
	if err != nil {
		return GLTFRefs{}, err
	}

	var doc gltfDoc
	if err := json.Unmarshal(data, &doc); err != nil {
		return GLTFRefs{}, fmt.Errorf("invalid gltf json: %w", err)
	}

	refs := GLTFRefs{
		Buffers: make([]string, 0, len(doc.Buffers)),
		Images:  make([]string, 0, len(doc.Images)),
	}

	for _, b := range doc.Buffers {
		refs.Buffers = append(refs.Buffers, b.URI)
		if err := validateURI(modelDir, b.URI); err != nil {
			return GLTFRefs{}, fmt.Errorf("buffer uri %q: %w", b.URI, err)
		}
	}
	for _, img := range doc.Images {
		refs.Images = append(refs.Images, img.URI)
		if err := validateURI(modelDir, img.URI); err != nil {
			return GLTFRefs{}, fmt.Errorf("image uri %q: %w", img.URI, err)
		}
	}

	return refs, nil
}

func validateURI(modelDir, uri string) error {
	if uri == "" {
		return nil
	}
	if strings.HasPrefix(uri, "data:") {
		return nil
	}
	if strings.HasPrefix(uri, "http://") || strings.HasPrefix(uri, "https://") {
		return fmt.Errorf("external uri not allowed")
	}
	if strings.Contains(uri, "://") {
		return fmt.Errorf("external uri not allowed")
	}
	if strings.HasPrefix(uri, "/") {
		return fmt.Errorf("absolute uri not allowed")
	}
	if strings.Contains(uri, "\\") {
		return fmt.Errorf("invalid path separator")
	}
	if strings.Contains(uri, "..") {
		for _, seg := range strings.Split(uri, "/") {
			if seg == ".." {
				return fmt.Errorf("path traversal not allowed")
			}
		}
	}

	clean := path.Clean(uri)
	if clean == "." {
		return nil
	}
	if path.IsAbs(clean) || strings.HasPrefix(clean, "..") || strings.Contains(clean, "/..") {
		return fmt.Errorf("path traversal not allowed")
	}

	full := filepath.Join(modelDir, filepath.FromSlash(clean))
	info, err := os.Stat(full)
	if err != nil {
		return err
	}
	if info.IsDir() {
		return fmt.Errorf("uri points to directory")
	}
	return nil
}
