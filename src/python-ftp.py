from ftplib import FTP
import sys

def fetch_bom_forecast(ftp_file):
    ftp_host = "ftp.bom.gov.au"
    ftp_dir = "/anon/gen/fwo/"
    lines = []
    
    # Set a timeout for the FTP connection (e.g., 30 seconds)
    ftp_timeout = 30 

    try:
        with FTP(ftp_host, timeout=ftp_timeout) as ftp: # Added timeout parameter
            ftp.login()  # anonymous login
            ftp.cwd(ftp_dir)
            def handle_line(line):
                if len(lines) < 100:
                    lines.append(line)
            ftp.retrlines(f"RETR {ftp_file}", callback=handle_line)
            ftp.quit()
            print("FTP connection closed.")
            print("Fetched forecast data:")
            print("\n".join(lines))
        return "\n".join(lines)
    except Exception as e:
        # Print the specific error to stderr and exit with a non-zero code
        print(f"FTP connection or operation failed: {e}", file=sys.stderr)
        sys.exit(1) # Indicate failure to the calling process

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python python-ftp.py <ftp_file>", file=sys.stderr)
        sys.exit(1)
    forecast_file = sys.argv[1]
    forecast = fetch_bom_forecast(forecast_file)
    print(forecast)