package ingest

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
)

const (
	maxTotalBytes = 200 << 20
	maxFileBytes  = 100 << 20
)

var allowedExt = map[string]struct{}{
	".gltf": {},
	".glb":  {},
	".bin":  {},
	".png":  {},
	".jpg":  {},
	".jpeg": {},
	".webp": {},
}

type ExtractResult struct {
	Root string
	Temp string
}

func ExtractZip(zipPath, destDir string) (ExtractResult, error) {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return ExtractResult{}, err
	}
	defer r.Close()

	if err := os.MkdirAll(destDir, 0o755); err != nil {
		return ExtractResult{}, err
	}

	var total uint64
	for _, f := range r.File {
		name := strings.ReplaceAll(f.Name, "\\", "/")
		if name == "" {
			continue
		}
		if isJunkEntry(name) {
			continue
		}
		if strings.HasPrefix(name, "/") {
			return ExtractResult{}, fmt.Errorf("zip entry has absolute path: %s", name)
		}
		if strings.Contains(name, "..") {
			for _, seg := range strings.Split(name, "/") {
				if seg == ".." {
					return ExtractResult{}, fmt.Errorf("zip entry has invalid path: %s", name)
				}
			}
		}
		if strings.Contains(name, ":") {
			return ExtractResult{}, fmt.Errorf("zip entry has invalid path: %s", name)
		}

		clean := path.Clean(name)
		if clean == "." {
			continue
		}

		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(filepath.Join(destDir, filepath.FromSlash(clean)), 0o755); err != nil {
				return ExtractResult{}, err
			}
			continue
		}

		if f.Mode()&os.ModeSymlink != 0 {
			return ExtractResult{}, fmt.Errorf("zip entry is a symlink: %s", name)
		}

		ext := strings.ToLower(filepath.Ext(clean))
		if _, ok := allowedExt[ext]; !ok {
			return ExtractResult{}, fmt.Errorf("zip entry has unsupported extension: %s", name)
		}

		if f.UncompressedSize64 > maxFileBytes {
			return ExtractResult{}, fmt.Errorf("zip entry too large: %s", name)
		}
		total += f.UncompressedSize64
		if total > maxTotalBytes {
			return ExtractResult{}, fmt.Errorf("zip too large")
		}

		dstPath := filepath.Join(destDir, filepath.FromSlash(clean))
		if !strings.HasPrefix(dstPath, destDir+string(os.PathSeparator)) && dstPath != destDir {
			return ExtractResult{}, fmt.Errorf("zip entry escapes dest: %s", name)
		}

		if err := os.MkdirAll(filepath.Dir(dstPath), 0o755); err != nil {
			return ExtractResult{}, err
		}

		if err := writeZipFile(f, dstPath); err != nil {
			return ExtractResult{}, err
		}
	}

	root, err := detectRootDir(destDir)
	if err != nil {
		return ExtractResult{}, err
	}

	return ExtractResult{Root: root, Temp: destDir}, nil
}

func writeZipFile(f *zip.File, dstPath string) error {
	rc, err := f.Open()
	if err != nil {
		return err
	}
	defer rc.Close()

	dst, err := os.OpenFile(dstPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	defer dst.Close()

	limit := int64(maxFileBytes) + 1
	n, err := io.Copy(dst, io.LimitReader(rc, limit))
	if err != nil {
		return err
	}
	if n > int64(maxFileBytes) {
		return fmt.Errorf("zip entry too large: %s", f.Name)
	}
	return nil
}

func detectRootDir(destDir string) (string, error) {
	entries, err := os.ReadDir(destDir)
	if err != nil {
		return "", err
	}
	var filtered []os.DirEntry
	for _, e := range entries {
		if isJunkName(e.Name()) {
			continue
		}
		filtered = append(filtered, e)
	}
	if len(filtered) == 1 && filtered[0].IsDir() {
		return filepath.Join(destDir, filtered[0].Name()), nil
	}
	return destDir, nil
}

func isJunkEntry(name string) bool {
	if strings.HasPrefix(name, "__MACOSX/") {
		return true
	}
	if path.Base(name) == ".DS_Store" {
		return true
	}
	return false
}

func isJunkName(name string) bool {
	return name == "__MACOSX" || name == ".DS_Store"
}
