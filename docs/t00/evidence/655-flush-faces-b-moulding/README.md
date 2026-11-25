# #655 批 2 补：藻井线脚随板同移（凌霄阁、大殿）

美术初审意见：藻井四块井板内移后线脚没跟着动，四边露边不一致。`framing.js` `caisson()` 里线脚现在移同样的量（x − sx·0.06，z − sz·0.03），尺寸不变，四边回到 6 cm 露边，线脚仍压在天花板口沿上。

`collage.jpg`：每行 左 = 移前（05d55ec），中 = 移后，右 = 差异 ×8；上 = 凌霄阁 `lingxiao-roof`，下 = 大殿 `main-roof`。手机尺寸 390×844 @2x，low 档，同一机位。差异只在井口边缘一圈。

`flush-faces`（t00 / t05 / _probe）行数不变，`flush-faces.test` 通过，`interior.test` 通过。
