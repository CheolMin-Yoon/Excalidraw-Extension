using System;
using System.Diagnostics;
using System.IO;

internal static class Program
{
    private static byte[] ReadExactly(Stream stream, int length)
    {
        byte[] buffer = new byte[length];
        int offset = 0;
        while (offset < length)
        {
            int count = stream.Read(buffer, offset, length - offset);
            if (count == 0) throw new EndOfStreamException();
            offset += count;
        }
        return buffer;
    }

    public static int Main()
    {
        try
        {
            string directory = AppDomain.CurrentDomain.BaseDirectory;
            string nodePath = File.ReadAllText(Path.Combine(directory, "node-path.txt")).Trim();
            string hostPath = Path.Combine(directory, "host.mjs");
            var startInfo = new ProcessStartInfo
            {
                FileName = nodePath,
                Arguments = "\"" + hostPath.Replace("\"", "\\\"") + "\"",
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            };
            using (Process process = Process.Start(startInfo))
            {
                process.BeginErrorReadLine();
                Stream input = Console.OpenStandardInput();
                byte[] header = ReadExactly(input, 4);
                int length = BitConverter.ToInt32(header, 0);
                if (length < 0 || length > 65536) return 1;
                byte[] body = ReadExactly(input, length);
                process.StandardInput.BaseStream.Write(header, 0, header.Length);
                process.StandardInput.BaseStream.Write(body, 0, body.Length);
                process.StandardInput.Close();
                process.StandardOutput.BaseStream.CopyTo(Console.OpenStandardOutput());
                process.WaitForExit();
                return process.ExitCode;
            }
        }
        catch
        {
            return 1;
        }
    }
}
