# Get started

Serve this directory over HTTP or HTTPS, for example with Python 3:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/`. For the original diagnostic, select **Port output
diagnostic**, then Run or Step four times: port E9 shows `K` and the machine halts.
Select **Arithmetic / subroutine** to execute an array checksum loop and subroutine;
the fresh guest emits `F`. Select **Guest-controlled segments** to run a guest
that loads DS and ES and emits `V`. Select **Keyboard echo diagnostic**, Run, focus the
display and type printable ASCII; the guest reads the keyboard and writes text
memory. Select **Disk diagnostic** and
Run to read, modify and reread a synthetic disk byte through guest instructions.
Save commits staged changes to browser storage; Export downloads the committed image.
A reset discards uncommitted disk changes but retains committed revisions. The disk
protocol uses 16-byte lab sectors and is not an ordinary PC disk format.

The loader begins at `0000:7c00`; it is not hardware reset or BIOS boot. See the
[support matrix](docs/SUPPORT.md) for the exact profile and verification limits.

For development checks use Node.js **24.22.1**, pinned in `.node-version`:

```sh
node --test
git diff --check
```

No package install or build step is required. Python is an optional local serving
tool, not a shipped runtime dependency. Browser storage can be denied or evicted;
export a committed image to retain a portable copy.
