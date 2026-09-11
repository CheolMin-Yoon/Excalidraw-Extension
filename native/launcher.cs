using System;
using System.Diagnostics;
using System.IO;
using System.Threading;

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

    public static int Main(string[] args)
    {
        try
        {
            string directory = AppDomain.CurrentDomain.BaseDirectory;
            string nodePath = File.ReadAllText(Path.Combine(directory, "node-path.txt")).Trim();
            bool serverMode = args.Length > 0 && args[0] == "--server";
            string hostPath = Path.Combine(directory, serverMode ? "server.mjs" : "host.mjs");
            var startInfo = new ProcessStartInfo
            {
                FileName = nodePath,
                Arguments = "\"" + hostPath.Replace("\"", "\\\"") + "\"",
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardInput = !serverMode,
                RedirectStandardOutput = !serverMode,
                RedirectStandardError = !serverMode,
            };
            if (serverMode)
            {
                while (true)
                {
                    using (Process process = Process.Start(startInfo))
                    {
                        process.WaitForExit();
                    }
                    Thread.Sleep(1000);
                }
            }
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
