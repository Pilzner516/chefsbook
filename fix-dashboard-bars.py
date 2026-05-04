#!/usr/bin/env python3
"""
Fix dashboard metric bar legibility by moving text above the bars.
Restructures CPU, RAM, and DISK metrics so values are displayed above the progress bar,
not inside it, preventing overlap with the colored fill.
"""

import re

# Read the file
with open('/home/pilzner/luxlabs-dashboard/public/index.html', 'r') as f:
    content = f.read()

# 1. Update CSS - add .metric-value styles and update .progress-bar
css_insert_point = content.find('    /* System Vitals */')
if css_insert_point == -1:
    raise ValueError("Could not find CSS insertion point")

new_css = '''    /* System Vitals */
    .metric-row {
      margin: 12px 0;
    }

    .metric-value {
      display: block;
      font-size: 15px;
      font-family: 'Share Tech Mono', monospace;
      color: #e0e6ed;
      margin-bottom: 6px;
      text-shadow: 0 1px 4px rgba(0,0,0,1);
    }

    .metric-value.bright { color: #00ff88; }
    .metric-value.warn { color: #ffb830; text-shadow: 0 1px 4px rgba(0,0,0,1); }
    .metric-value.crit { color: #ff3b5c; text-shadow: 0 1px 4px rgba(0,0,0,1); }

    .progress-bar {
      background: #1a2332;
      height: 24px;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 4px;
      position: relative;
    }

    .progress-fill {
      height: 100%;
      transition: width 0.5s ease, background 0.3s;
      overflow: hidden;
    }

    .progress-fill.green { background: #00ff88; }
    .progress-fill.amber { background: #ffb830; }
    .progress-fill.red { background: #ff3b5c; }'''

# Find and replace the old .progress-bar CSS block
old_css_pattern = r'    /\* System Vitals \*/\s+\.progress-bar \{[^}]+\}\s+\.progress-fill \{[^}]+\}\s+\.progress-fill\.green[^}]+\}\s+\.progress-fill\.amber[^}]+\}\s+\.progress-fill\.red[^}]+\}'
content = re.sub(old_css_pattern, new_css, content, count=1)

# 2. Update HTML structure for CPU metric
cpu_old = '''        <div>
          <div style="font-size: 14px; opacity: 0.5; margin-bottom: 4px;">CPU</div>
          <div class="progress-bar">
            <div class="progress-fill green" id="cpu-bar" style="width: 0%">0%</div>
          </div>
        </div>'''

cpu_new = '''        <div class="metric-row">
          <div style="font-size: 14px; opacity: 0.5; margin-bottom: 4px;">CPU</div>
          <div class="metric-value" id="cpu-value">0%</div>
          <div class="progress-bar">
            <div class="progress-fill green" id="cpu-bar" style="width: 0%"></div>
          </div>
        </div>'''

content = content.replace(cpu_old, cpu_new)

# 3. Update HTML structure for RAM metric
ram_old = '''        <div>
          <div style="font-size: 14px; opacity: 0.5; margin-bottom: 4px;">RAM</div>
          <div class="progress-bar">
            <div class="progress-fill green" id="ram-bar" style="width: 0%">0 / 0 MB (0%)</div>
          </div>
        </div>'''

ram_new = '''        <div class="metric-row">
          <div style="font-size: 14px; opacity: 0.5; margin-bottom: 4px;">RAM</div>
          <div class="metric-value" id="ram-value">0 / 0 MB (0%)</div>
          <div class="progress-bar">
            <div class="progress-fill green" id="ram-bar" style="width: 0%"></div>
          </div>
        </div>'''

content = content.replace(ram_old, ram_new)

# 4. Update HTML structure for DISK metric
disk_old = '''        <div>
          <div style="font-size: 14px; opacity: 0.5; margin-bottom: 4px;">DISK</div>
          <div class="progress-bar">
            <div class="progress-fill green" id="disk-bar" style="width: 0%">0%</div>
          </div>
        </div>'''

disk_new = '''        <div class="metric-row">
          <div style="font-size: 14px; opacity: 0.5; margin-bottom: 4px;">DISK</div>
          <div class="metric-value" id="disk-value">0%</div>
          <div class="progress-bar">
            <div class="progress-fill green" id="disk-bar" style="width: 0%"></div>
          </div>
        </div>'''

content = content.replace(disk_old, disk_new)

# 5. Update JavaScript for CPU bar
cpu_js_old = '''      // CPU bar
      const cpuPct = d.cpu || 0;
      const cpuBar = document.getElementById('cpu-bar');
      cpuBar.style.width = `${cpuPct}%`;
      cpuBar.textContent = `${cpuPct}%`;
      cpuBar.className = 'progress-fill ' + (cpuPct > 85 ? 'red' : cpuPct > 65 ? 'amber' : 'green');'''

cpu_js_new = '''      // CPU bar
      const cpuPct = d.cpu || 0;
      const cpuBar = document.getElementById('cpu-bar');
      const cpuValue = document.getElementById('cpu-value');
      cpuBar.style.width = `${cpuPct}%`;
      cpuValue.textContent = `${cpuPct}%`;
      cpuBar.className = 'progress-fill ' + (cpuPct > 85 ? 'red' : cpuPct > 65 ? 'amber' : 'green');
      cpuValue.className = 'metric-value ' + (cpuPct > 85 ? 'crit' : cpuPct > 65 ? 'warn' : 'bright');'''

content = content.replace(cpu_js_old, cpu_js_new)

# 6. Update JavaScript for RAM bar
ram_js_old = '''      // RAM bar
      const ramPct = d.ram?.pct || 0;
      const ramBar = document.getElementById('ram-bar');
      ramBar.style.width = `${ramPct}%`;
      ramBar.textContent = `${d.ram?.used || 0} / ${d.ram?.total || 0} MB (${ramPct}%)`;
      ramBar.className = 'progress-fill ' + (ramPct > 90 ? 'red' : ramPct > 75 ? 'amber' : 'green');'''

ram_js_new = '''      // RAM bar
      const ramPct = d.ram?.pct || 0;
      const ramBar = document.getElementById('ram-bar');
      const ramValue = document.getElementById('ram-value');
      ramBar.style.width = `${ramPct}%`;
      ramValue.textContent = `${d.ram?.used || 0} / ${d.ram?.total || 0} MB (${ramPct}%)`;
      ramBar.className = 'progress-fill ' + (ramPct > 90 ? 'red' : ramPct > 75 ? 'amber' : 'green');
      ramValue.className = 'metric-value ' + (ramPct > 90 ? 'crit' : ramPct > 75 ? 'warn' : 'bright');'''

content = content.replace(ram_js_old, ram_js_new)

# 7. Update JavaScript for DISK bar
disk_js_old = '''      // Disk
      const diskPct = d.disk?.pct || 0;
      const diskBar = document.getElementById('disk-bar');
      diskBar.style.width = `${diskPct}%`;
      diskBar.textContent = `${d.disk?.used || '—'} / ${d.disk?.total || '—'} (${diskPct}%)`;
      diskBar.className = 'progress-fill ' + (diskPct > 90 ? 'red' : diskPct > 75 ? 'amber' : 'green');'''

disk_js_new = '''      // Disk
      const diskPct = d.disk?.pct || 0;
      const diskBar = document.getElementById('disk-bar');
      const diskValue = document.getElementById('disk-value');
      diskBar.style.width = `${diskPct}%`;
      diskValue.textContent = `${d.disk?.used || '—'} / ${d.disk?.total || '—'} (${diskPct}%)`;
      diskBar.className = 'progress-fill ' + (diskPct > 90 ? 'red' : diskPct > 75 ? 'amber' : 'green');
      diskValue.className = 'metric-value ' + (diskPct > 90 ? 'crit' : diskPct > 75 ? 'warn' : 'bright');'''

content = content.replace(disk_js_old, disk_js_new)

# Write the modified content back
with open('/home/pilzner/luxlabs-dashboard/public/index.html', 'w') as f:
    f.write(content)

print("✓ CSS updated with .metric-value, .metric-row styles")
print("✓ HTML restructured for CPU, RAM, DISK (text above bars)")
print("✓ JavaScript updated to populate separate value elements")
print("✓ Text-shadow and color variants applied for legibility")
print("✓ Progress-fill overflow: hidden enforced")
