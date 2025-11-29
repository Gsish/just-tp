package main

import (
    "encoding/json"
    "log"
    "net/http"
    "os"
    "path/filepath"
    "time"
)

const pdfDir = "./pdfs" 

type PDFInfo struct {
    Name    string    
    Size    int64     
    ModTime time.Time 
    URL     string    
}

func listPDFsHandler(w http.ResponseWriter, r *http.Request) {
    entries, err := os.ReadDir(pdfDir)
    if err != nil {
        http.Error(w, "failed to read pdf directory", http.StatusInternalServerError)
        log.Println("readDir error:", err)
        return
    }

    var pdfs []PDFInfo

    for _, entry := range entries {
        if entry.IsDir() {
            continue
        }
        if filepath.Ext(entry.Name()) != ".pdf" {
            continue
        }

        fullPath := filepath.Join(pdfDir, entry.Name())
        info, err := os.Stat(fullPath)
        if err != nil {
            log.Println("stat error:", err)
            continue
        }

        pdfs = append(pdfs, PDFInfo{
            Name:    entry.Name(),
            Size:    info.Size(),      
            ModTime: info.ModTime(),    
            URL:     "/pdfs/" + entry.Name(),
        })
    }

    w.Header().Set("Content-Type", "application/json")
   
    w.Header().Set("Access-Control-Allow-Origin", "*")
    json.NewEncoder(w).Encode(pdfs)
}

func main() {
   
    http.HandleFunc("/api/pdfs", listPDFsHandler)

   
    fs := http.FileServer(http.Dir(pdfDir))
    http.Handle("/pdfs/", http.StripPrefix("/pdfs/", fs))

    log.Println("Server running on http://localhost:8080")
    if err := http.ListenAndServe(":8080", nil); err != nil {
        log.Fatal(err)
    }
}
