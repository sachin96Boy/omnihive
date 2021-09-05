---
title: File System Worker
---

### Interface Name: IFileSystemWorker

## Required Functions:

### copyDirectory

-   <strong>arguments</strong>: (sourcePath: string, destPath: string)
-   <strong>returns</strong>: void
-   <strong>purpose</strong>: Copy the directory from the source to the destination provided.

### copyFile

-   <strong>arguments</strong>: (sourceFile: string, destFile: string)
-   <strong>returns</strong>: void
-   <strong>purpose</strong>: Copy the file from the source to the destination provided.

### directoryHasFiles

-   <strong>arguments</strong>: (path: string)
-   <strong>returns</strong>: boolean
-   <strong>purpose</strong>: Detect if the provided directory has files inside of it.

### ensureFolderExists

-   <strong>arguments</strong>: (path: string)
-   <strong>returns</strong>: void
-   <strong>purpose</strong>: If the directory does not exist, then create it.

### getCurrentExecutionDirectory

-   <strong>arguments</strong>: none
-   <strong>returns</strong>: string
-   <strong>purpose</strong>: Retrieve the directory that the program is being ran on.

### getCurrentFileDirectory

-   <strong>arguments</strong>: none
-   <strong>returns</strong>: string
-   <strong>purpose</strong>: Retrieve the directory of the current file.

### readFile

-   <strong>arguments</strong>: (path: string)
-   <strong>returns</strong>: string
-   <strong>purpose</strong>: Retrieve the contents of the file provided.

### readFileNamesFromDirectory

-   <strong>arguments</strong>: (path: string)
-   <strong>returns</strong>: string[]
-   <strong>purpose</strong>: Retrieve all of the file names in the provided directory

### removeFile

-   <strong>arguments</strong>: (path: string)
-   <strong>returns</strong>: void
-   <strong>purpose</strong>: Remove the provided file from the system.

### removeFilesFromDirectory

-   <strong>arguments</strong>: (path: string)
-   <strong>returns</strong>: void
-   <strong>purpose</strong>: Remove all files from the provided directory

### writeDataToFile

-   <strong>arguments</strong>: (path: string, data: any)
-   <strong>returns</strong>: void
-   <strong>purpose</strong>: Write the provided data to the provided file.

### writeJsonToFile

-   <strong>arguments</strong>: (path: string, data: any)
-   <strong>returns</strong>: void
-   <strong>purpose</strong>: Write the provided json to the provided file.
