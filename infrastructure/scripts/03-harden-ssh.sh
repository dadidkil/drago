#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Шаг 3. Ужесточение SSH: только ключи, root — только по ключу.
# ЗАПУСКАТЬ ТОЛЬКО ПОСЛЕ ТОГО, как вы УСПЕШНО вошли по ключу в НОВОЙ сессии.
# Текущую сессию не закрывайте, пока не проверите вход в новой.
#   sudo bash infrastructure/scripts/03-harden-ssh.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Запустите от root"; exit 1; }

keys=0
for f in /root/.ssh/authorized_keys /home/*/.ssh/authorized_keys; do
  [ -f "$f" ] && keys=$((keys + $(grep -cE '^(ssh-|ecdsa-|sk-)' "$f" || true)))
done
if [ "$keys" -eq 0 ]; then
  echo "❌ Не найдено ни одного SSH-ключа в authorized_keys. Сначала добавьте ключ:"
  echo "   (на своём компьютере) ssh-keygen -t ed25519 && ssh-copy-id root@<ip>"
  exit 1
fi
echo "Найдено ключей: $keys"
echo "Вы проверили вход по ключу в НОВОМ окне терминала (ssh -o PasswordAuthentication=no root@<ip>)?"
read -r -p "Введите 'да' для продолжения: " ok
[ "$ok" = "да" ] || { echo "Отменено"; exit 1; }

cp -a /etc/ssh/sshd_config "/etc/ssh/sshd_config.bak-$(date +%Y%m%d-%H%M%S)"
cat > /etc/ssh/sshd_config.d/99-drago-hardening.conf <<'CONF'
# ТОП «Драго»: вход только по ключам
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
PubkeyAuthentication yes
PermitEmptyPasswords no
MaxAuthTries 4
LoginGraceTime 30
X11Forwarding no
AllowAgentForwarding no
ClientAliveInterval 300
ClientAliveCountMax 2
CONF

if sshd -t; then
  systemctl reload ssh 2>/dev/null || systemctl reload sshd
  echo "✅ SSH перезагружен. НЕ закрывайте эту сессию — проверьте вход в новой."
  echo "   Откат: rm /etc/ssh/sshd_config.d/99-drago-hardening.conf && systemctl reload ssh"
else
  rm -f /etc/ssh/sshd_config.d/99-drago-hardening.conf
  echo "❌ Ошибка конфигурации sshd — изменения откатаны."
  exit 1
fi
